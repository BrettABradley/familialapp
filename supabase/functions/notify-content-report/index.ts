import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_SECRET = Deno.env.get("ADMIN_MODERATE_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (c) => entities[c] || c);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const {
      reportId,
      reason,
      details,
      postId,
      commentId,
      reportedUserId,
      reporterId,
    } = await req.json();

    if (!reportId || !reason || !reporterId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch display names
    const { data: reporterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", reporterId)
      .single();

    let reportedName = "Unknown";
    if (reportedUserId) {
      const { data: reportedProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", reportedUserId)
        .single();
      reportedName = reportedProfile?.display_name || "Unknown";
    }

    const safe = (v: string) => escapeHtml(v || "");

    // Build action links
    const banUrl = `${SUPABASE_URL}/functions/v1/moderate-reported-user?report_id=${reportId}&action=ban_user&secret=${ADMIN_SECRET}`;
    const dismissUrl = `${SUPABASE_URL}/functions/v1/moderate-reported-user?report_id=${reportId}&action=dismiss&secret=${ADMIN_SECRET}`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
<div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <h1 style="color: #dc2626; font-size: 24px; margin: 0 0 20px 0;">🚩 Content Report</h1>
  <p style="color: #666; font-size: 14px; margin: 0 0 20px 0;">The reported content has been <strong>automatically hidden</strong> from the circle pending your review.</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #333;">
    <tr><td style="padding: 8px 0; font-weight: 600; width: 140px;">Report ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${safe(reportId)}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Reporter</td><td style="padding: 8px 0;">${safe(reporterProfile?.display_name || "Unknown")}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Reported User</td><td style="padding: 8px 0;">${safe(reportedName)}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Reason</td><td style="padding: 8px 0;">${safe(reason)}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Details</td><td style="padding: 8px 0;">${safe(details) || "None provided"}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Post ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${safe(postId) || "N/A"}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Comment ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${safe(commentId) || "N/A"}</td></tr>
  </table>
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; display: flex; gap: 12px;">
    <a href="${banUrl}" style="display: inline-block; background-color: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">🚫 Ban & Remove User</a>
    <a href="${dismissUrl}" style="display: inline-block; background-color: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">✅ Dismiss Report</a>
  </div>
  <p style="color: #888; font-size: 12px; margin-top: 12px;"><strong>Ban & Remove</strong>: Permanently bans the user, removes from all circles, and deletes the content.<br/><strong>Dismiss</strong>: Restores the hidden content and closes the report.</p>
</div></div></body></html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Familial <support@support.familialmedia.com>",
        to: ["support@familialmedia.com"],
        subject: `🚩 Content Report: ${safe(reason)} — ${safe(reportedName)}`,
        html,
      }),
    });

    const result = await emailResponse.json();
    if (!emailResponse.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Failed to send notification" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
