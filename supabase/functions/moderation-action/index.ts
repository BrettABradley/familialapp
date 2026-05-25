import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | "dismiss"
  | "restore"
  | "delete_content"
  | "warn"
  | "suspend_7d"
  | "ban"
  | "mark_spam_reporter";

const VALID_ACTIONS: Action[] = [
  "dismiss",
  "restore",
  "delete_content",
  "warn",
  "suspend_7d",
  "ban",
  "mark_spam_reporter",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const actorId = userData.user.id;
    const actorEmail = userData.user.email ?? "unknown";

    // Platform admin check
    const { data: isAdminRow } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", actorId)
      .maybeSingle();
    if (!isAdminRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const reportId: string | undefined = body.report_id;
    const action: Action | undefined = body.action;
    const note: string = (body.note ?? "").toString().slice(0, 1000);

    if (!reportId || !action || !VALID_ACTIONS.includes(action)) {
      return json({ error: "Invalid report_id or action" }, 400);
    }

    const { data: report, error: repErr } = await admin
      .from("content_reports")
      .select("*")
      .eq("id", reportId)
      .single();
    if (repErr || !report) return json({ error: "Report not found" }, 404);

    const results: string[] = [];
    const targetUserId: string | null = report.reported_user_id;

    // === RESTORE ===
    if (action === "restore" || action === "dismiss") {
      if (report.post_id) {
        await admin.from("posts").update({ is_hidden: false }).eq("id", report.post_id);
        results.push("Post restored");
      }
      if (report.comment_id) {
        await admin.from("comments").update({ is_hidden: false }).eq("id", report.comment_id);
        results.push("Comment restored");
      }
      await admin.from("content_reports").update({
        status: "dismissed",
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
        resolution_note: note || null,
      }).eq("id", reportId);
      results.push("Report dismissed");
    }

    // === DELETE CONTENT ===
    if (action === "delete_content") {
      if (report.post_id) {
        await admin.from("posts").delete().eq("id", report.post_id);
        results.push("Post deleted");
      }
      if (report.comment_id) {
        await admin.from("comments").delete().eq("id", report.comment_id);
        results.push("Comment deleted");
      }
      await admin.from("content_reports").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
        resolution_note: note || null,
      }).eq("id", reportId);
    }

    // === WARN ===
    if (action === "warn" && targetUserId) {
      await admin.from("notifications").insert({
        user_id: targetUserId,
        type: "moderation_warning",
        title: "Content Warning",
        message: note || "One of your posts was reported. Please review our community guidelines.",
      });
      await admin.from("content_reports").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
        resolution_note: note || null,
      }).eq("id", reportId);
      results.push("User warned");
    }

    // === SUSPEND 7d ===
    if (action === "suspend_7d" && targetUserId) {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "168h" });
      await admin.from("user_private").upsert({
        user_id: targetUserId,
        account_status: "suspended",
        suspended_until: until,
      }, { onConflict: "user_id" });
      await admin.from("user_strikes").insert({
        user_id: targetUserId,
        report_id: reportId,
        severity: report.severity,
        reason: report.reason,
      });
      await admin.from("notifications").insert({
        user_id: targetUserId,
        type: "moderation_suspend",
        title: "Account Suspended",
        message: "Your account has been suspended for 7 days.",
      });
      await admin.from("content_reports").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
        resolution_note: note || null,
      }).eq("id", reportId);
      results.push("User suspended 7 days");
    }

    // === BAN ===
    if (action === "ban" && targetUserId) {
      // Remove from circles
      await admin.from("circle_memberships").delete().eq("user_id", targetUserId);
      // Transfer-block owned circles
      const { data: owned } = await admin
        .from("circles").select("id").eq("owner_id", targetUserId);
      if (owned && owned.length > 0) {
        await admin.from("circles").update({ transfer_block: true })
          .in("id", owned.map((c: any) => c.id));
      }
      // Auth ban + email ban
      const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);
      const email = authUser?.user?.email;
      if (email) {
        await admin.from("banned_emails").upsert(
          { email, reason: report.reason, report_id: reportId },
          { onConflict: "email" },
        );
      }
      await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876600h" });
      await admin.from("user_private").upsert({
        user_id: targetUserId,
        account_status: "banned",
        suspended_until: null,
      }, { onConflict: "user_id" });

      // Delete the reported content
      if (report.post_id) await admin.from("posts").delete().eq("id", report.post_id);
      if (report.comment_id) await admin.from("comments").delete().eq("id", report.comment_id);

      await admin.from("content_reports").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
        resolution_note: note || null,
      }).eq("id", reportId);
      results.push("User banned");
    }

    // === MARK REPORTER AS SPAM ===
    if (action === "mark_spam_reporter") {
      await admin.from("user_private").upsert({
        user_id: report.reporter_id,
        spam_reporter: true,
      }, { onConflict: "user_id" });
      // Restore content (this report is bogus)
      if (report.post_id) await admin.from("posts").update({ is_hidden: false }).eq("id", report.post_id);
      if (report.comment_id) await admin.from("comments").update({ is_hidden: false }).eq("id", report.comment_id);
      await admin.from("content_reports").update({
        status: "dismissed",
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
        resolution_note: note || "Reporter flagged as spam",
      }).eq("id", reportId);
      results.push("Reporter flagged");
    }

    // Always log the decision
    await admin.from("moderation_decisions").insert({
      report_id: reportId,
      actor_id: actorId,
      action,
      note: note || null,
    });
    await admin.from("admin_actions").insert({
      admin_email: actorEmail,
      action_type: action,
      target_user_id: targetUserId,
      target_content_id: report.post_id || report.comment_id || null,
      details: { report_id: reportId, reason: report.reason, note },
    });

    // Auto-escalation: 3 active strikes -> 7d suspend, 5 -> ban
    if (targetUserId && (action === "warn" || action === "delete_content")) {
      // Treat delete_content as a strike
      if (action === "delete_content") {
        await admin.from("user_strikes").insert({
          user_id: targetUserId,
          report_id: reportId,
          severity: report.severity,
          reason: report.reason,
        });
      }
      const { count } = await admin
        .from("user_strikes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId)
        .is("voided_at", null)
        .gt("expires_at", new Date().toISOString());
      const strikes = count ?? 0;
      if (strikes >= 5) {
        await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876600h" });
        await admin.from("user_private").upsert({
          user_id: targetUserId,
          account_status: "banned",
        }, { onConflict: "user_id" });
        results.push(`Auto-ban (${strikes} strikes)`);
      } else if (strikes >= 3) {
        const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "168h" });
        await admin.from("user_private").upsert({
          user_id: targetUserId,
          account_status: "suspended",
          suspended_until: until,
        }, { onConflict: "user_id" });
        results.push(`Auto-suspend 7d (${strikes} strikes)`);
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error("moderation-action error:", e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
