import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const ADMIN_SECRET = Deno.env.get("ADMIN_MODERATE_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">❌ Unauthorized</h1>
          <p>Invalid admin credentials.</p>
        </body></html>`,
        { status: 401, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    if (!reportId || action !== "ban_user") {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">❌ Bad Request</h1>
          <p>Missing report_id or invalid action.</p>
        </body></html>`,
        { status: 400, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    // Use service role for admin operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Look up the report
    const { data: report, error: reportError } = await supabase
      .from("content_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">❌ Report Not Found</h1>
          <p>Report ID: ${reportId}</p>
        </body></html>`,
        { status: 404, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    if (report.status === "resolved") {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #f59e0b;">⚠️ Already Resolved</h1>
          <p>This report has already been handled.</p>
        </body></html>`,
        { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    const reportedUserId = report.reported_user_id;
    if (!reportedUserId) {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">❌ No Reported User</h1>
          <p>This report doesn't have a reported user ID.</p>
        </body></html>`,
        { status: 400, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    // 2. Get reported user's email from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(reportedUserId);
    if (authError || !authUser?.user) {
      console.error("Failed to fetch auth user:", authError);
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">❌ User Not Found</h1>
          <p>Could not find auth user for ID: ${reportedUserId}</p>
        </body></html>`,
        { status: 404, headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }

    const userEmail = authUser.user.email;
    const results: string[] = [];

    // 3. Remove user from all circle_memberships
    const { error: membershipError } = await supabase
      .from("circle_memberships")
      .delete()
      .eq("user_id", reportedUserId);
    results.push(membershipError ? `❌ Memberships: ${membershipError.message}` : "✅ Removed from all circles");

    // 4. For circles they own: set transfer_block = true
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

    // 5. Insert email into banned_emails
    if (userEmail) {
      const { error: banError } = await supabase
        .from("banned_emails")
        .upsert({ email: userEmail, reason: report.reason, report_id: reportId }, { onConflict: "email" });
      results.push(banError ? `❌ Ban email: ${banError.message}` : `✅ Email banned: ${userEmail}`);
    }

    // 6. Delete the reported content
    if (report.post_id) {
      const { error: postError } = await supabase.from("posts").delete().eq("id", report.post_id);
      results.push(postError ? `❌ Delete post: ${postError.message}` : "✅ Post deleted");
    }
    if (report.comment_id) {
      const { error: commentError } = await supabase.from("comments").delete().eq("id", report.comment_id);
      results.push(commentError ? `❌ Delete comment: ${commentError.message}` : "✅ Comment deleted");
    }

    // 7. Update report status
    const { error: statusError } = await supabase
      .from("content_reports")
      .update({ status: "resolved" })
      .eq("id", reportId);
    results.push(statusError ? `❌ Report status: ${statusError.message}` : "✅ Report marked resolved");

    // 8. Ban the user in auth
    const { error: banAuthError } = await supabase.auth.admin.updateUserById(reportedUserId, {
      ban_duration: "876600h", // ~100 years
    });
    results.push(banAuthError ? `❌ Auth ban: ${banAuthError.message}` : "✅ User auth account banned");

    // Return a nice HTML response for the email click
    const allSuccess = results.every((r) => r.startsWith("✅") || r.startsWith("ℹ️"));
    return new Response(
      `<html><body style="font-family: -apple-system, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${allSuccess ? "#16a34a" : "#f59e0b"};">${allSuccess ? "✅ User Banned Successfully" : "⚠️ Completed with Issues"}</h1>
        <ul style="list-style: none; padding: 0; font-size: 15px; line-height: 2;">
          ${results.map((r) => `<li>${r}</li>`).join("")}
        </ul>
        <p style="color: #888; font-size: 13px; margin-top: 20px;">Report ID: ${reportId}</p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Moderation error:", error);
    return new Response(
      `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1 style="color: #dc2626;">❌ Server Error</h1>
        <p>${msg}</p>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html", ...corsHeaders } }
    );
  }
});
