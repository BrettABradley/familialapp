import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const ADMIN_SECRET = Deno.env.get("ADMIN_MODERATE_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function htmlPage(title: string, color: string, body: string) {
  return `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
    <h1 style="color: ${color};">${title}</h1>
    ${body}
  </body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (from email link) and POST
    let reportId: string;
    let action: string;
    let secret: string;

    if (req.method === "GET") {
      const url = new URL(req.url);
      reportId = url.searchParams.get("report_id") || "";
      action = url.searchParams.get("action") || "";
      secret = url.searchParams.get("secret") || "";
    } else {
      const body = await req.json();
      reportId = body.report_id || "";
      action = body.action || "";
      secret = body.secret || "";
    }

    // Validate admin secret
    if (!secret || secret !== ADMIN_SECRET) {
      return new Response(
        htmlPage("❌ Unauthorized", "#dc2626", "<p>Invalid admin credentials.</p>"),
        { status: 401, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    if (!reportId || !["ban_user", "dismiss"].includes(action)) {
      return new Response(
        htmlPage("❌ Bad Request", "#dc2626", "<p>Missing report_id or invalid action. Valid actions: ban_user, dismiss.</p>"),
        { status: 400, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    // Use service role for admin operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up the report
    const { data: report, error: reportError } = await supabase
      .from("content_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        htmlPage("❌ Report Not Found", "#dc2626", `<p>Report ID: ${reportId}</p>`),
        { status: 404, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    if (report.status === "resolved" || report.status === "dismissed") {
      return new Response(
        htmlPage("⚠️ Already Handled", "#f59e0b", `<p>This report has already been ${report.status}.</p>`),
        { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    // === DISMISS ACTION ===
    if (action === "dismiss") {
      const results: string[] = [];

      // Restore hidden content
      if (report.post_id) {
        const { error } = await supabase.from("posts").update({ is_hidden: false }).eq("id", report.post_id);
        results.push(error ? `❌ Restore post: ${error.message}` : "✅ Post restored and visible again");
      }
      if (report.comment_id) {
        const { error } = await supabase.from("comments").update({ is_hidden: false }).eq("id", report.comment_id);
        results.push(error ? `❌ Restore comment: ${error.message}` : "✅ Comment restored and visible again");
      }

      // Mark report as dismissed
      const { error: statusError } = await supabase
        .from("content_reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);
      results.push(statusError ? `❌ Report status: ${statusError.message}` : "✅ Report dismissed");

      // Audit log
      await supabase.from("admin_actions").insert({
        admin_email: "support@familialmedia.com",
        action_type: "dismiss_report",
        target_content_id: report.post_id || report.comment_id || null,
        details: { report_id: reportId, reason: report.reason },
      });

      const allSuccess = results.every((r) => r.startsWith("✅"));
      return new Response(
        htmlPage(
          allSuccess ? "✅ Report Dismissed" : "⚠️ Completed with Issues",
          allSuccess ? "#16a34a" : "#f59e0b",
          `<p style="color: #666; margin-bottom: 16px;">The content has been restored and is visible in the circle again.</p>
          <ul style="list-style: none; padding: 0; font-size: 15px; line-height: 2;">
            ${results.map((r) => `<li>${r}</li>`).join("")}
          </ul>
          <p style="color: #888; font-size: 13px; margin-top: 20px;">Report ID: ${reportId}</p>`
        ),
        { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    // === BAN ACTION ===
    const reportedUserId = report.reported_user_id;
    if (!reportedUserId) {
      return new Response(
        htmlPage("❌ No Reported User", "#dc2626", "<p>This report doesn't have a reported user ID.</p>"),
        { status: 400, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    // Get reported user's email from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(reportedUserId);
    if (authError || !authUser?.user) {
      console.error("Failed to fetch auth user:", authError);
      return new Response(
        htmlPage("❌ User Not Found", "#dc2626", `<p>Could not find auth user for ID: ${reportedUserId}</p>`),
        { status: 404, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    const userEmail = authUser.user.email;
    const results: string[] = [];

    // Remove user from all circle_memberships
    const { error: membershipError } = await supabase
      .from("circle_memberships")
      .delete()
      .eq("user_id", reportedUserId);
    results.push(membershipError ? `❌ Memberships: ${membershipError.message}` : "✅ Removed from all circles");

    // For circles they own: set transfer_block = true
    const { data: ownedCircles, error: circlesError } = await supabase
      .from("circles")
      .select("id")
      .eq("owner_id", reportedUserId);

    if (!circlesError && ownedCircles && ownedCircles.length > 0) {
      const circleIds = ownedCircles.map((c: any) => c.id);
      const { error: transferError } = await supabase
        .from("circles")
        .update({ transfer_block: true })
        .in("id", circleIds);
      results.push(
        transferError
          ? `❌ Transfer block: ${transferError.message}`
          : `✅ ${circleIds.length} circle(s) put on trade block`
      );
    } else {
      results.push("ℹ️ No owned circles");
    }

    // Insert email into banned_emails
    if (userEmail) {
      const { error: banError } = await supabase
        .from("banned_emails")
        .upsert({ email: userEmail, reason: report.reason, report_id: reportId }, { onConflict: "email" });
      results.push(banError ? `❌ Ban email: ${banError.message}` : `✅ Email banned: ${userEmail}`);
    }

    // Delete the reported content (it was already hidden, now permanently remove)
    if (report.post_id) {
      const { error: postError } = await supabase.from("posts").delete().eq("id", report.post_id);
      results.push(postError ? `❌ Delete post: ${postError.message}` : "✅ Post deleted");
    }
    if (report.comment_id) {
      const { error: commentError } = await supabase.from("comments").delete().eq("id", report.comment_id);
      results.push(commentError ? `❌ Delete comment: ${commentError.message}` : "✅ Comment deleted");
    }

    // Update report status
    const { error: statusError } = await supabase
      .from("content_reports")
      .update({ status: "resolved" })
      .eq("id", reportId);
    results.push(statusError ? `❌ Report status: ${statusError.message}` : "✅ Report marked resolved");

    // Ban the user in auth
    const { error: banAuthError } = await supabase.auth.admin.updateUserById(reportedUserId, {
      ban_duration: "876600h",
    });
    results.push(banAuthError ? `❌ Auth ban: ${banAuthError.message}` : "✅ User auth account banned");

    // Audit log
    await supabase.from("admin_actions").insert({
      admin_email: "support@familialmedia.com",
      action_type: "ban_user",
      target_user_id: reportedUserId,
      target_content_id: report.post_id || report.comment_id || null,
      details: { report_id: reportId, reason: report.reason, user_email: userEmail },
    });

    const allSuccess = results.every((r) => r.startsWith("✅") || r.startsWith("ℹ️"));
    return new Response(
      htmlPage(
        allSuccess ? "✅ User Banned Successfully" : "⚠️ Completed with Issues",
        allSuccess ? "#16a34a" : "#f59e0b",
        `<ul style="list-style: none; padding: 0; font-size: 15px; line-height: 2;">
          ${results.map((r) => `<li>${r}</li>`).join("")}
        </ul>
        <p style="color: #888; font-size: 13px; margin-top: 20px;">Report ID: ${reportId}</p>`
      ),
      { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Moderation error:", error);
    return new Response(
      htmlPage("❌ Server Error", "#dc2626", `<p>${msg}</p>`),
      { status: 500, headers: { "Content-Type": "text/html", ...corsHeaders } }
    );
  }
});
