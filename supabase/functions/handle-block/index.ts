import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const { blocked_id } = await req.json();
    if (!blocked_id) throw new Error("blocked_id is required");

    // Get blocker's display name
    const { data: blockerProfile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    // Get blocked user's display name
    const { data: blockedProfile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("user_id", blocked_id)
      .single();

    // Send notification email to support
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Familial <support@support.familialmedia.com>",
          to: ["support@familialmedia.com"],
          subject: `[Block Report] User blocked on Familial`,
          html: `
            <h2>User Block Report</h2>
            <p><strong>Blocker:</strong> ${blockerProfile?.display_name || "Unknown"} (${user.id})</p>
            <p><strong>Blocked:</strong> ${blockedProfile?.display_name || "Unknown"} (${blocked_id})</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p>Please review the blocked user's content for potential violations within 24 hours.</p>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
