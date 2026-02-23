import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_EMAIL = "brettbradley007@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { companyName, companyEmail, companyPhone, offerTitle, offerDescription, targetLocations } = await req.json();

    if (!companyName || !companyEmail || !offerTitle) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const safe = (v: string) => escapeHtml(v || "");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
<div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
<h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px 0;">New Store Offer Submission</h1>
<table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #333;">
<tr><td style="padding: 8px 0; font-weight: 600; width: 140px;">Company</td><td style="padding: 8px 0;">${safe(companyName)}</td></tr>
<tr><td style="padding: 8px 0; font-weight: 600;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safe(companyEmail)}">${safe(companyEmail)}</a></td></tr>
<tr><td style="padding: 8px 0; font-weight: 600;">Phone</td><td style="padding: 8px 0;">${safe(companyPhone) || "Not provided"}</td></tr>
<tr><td style="padding: 8px 0; font-weight: 600;">Offer Title</td><td style="padding: 8px 0;">${safe(offerTitle)}</td></tr>
<tr><td style="padding: 8px 0; font-weight: 600;">Description</td><td style="padding: 8px 0;">${safe(offerDescription) || "Not provided"}</td></tr>
<tr><td style="padding: 8px 0; font-weight: 600;">Target Locations</td><td style="padding: 8px 0;">${safe(targetLocations) || "Nationwide"}</td></tr>
</table>
<p style="color: #888; font-size: 13px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">This offer is pending review in the database. Log in to approve or reject it.</p>
</div></div></body></html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Familial Media <welcome@support.familialmedia.com>",
        to: [NOTIFY_EMAIL],
        subject: `New Store Offer: ${safe(offerTitle)} from ${safe(companyName)}`,
        html,
      }),
    });

    const result = await emailResponse.json();
    if (!emailResponse.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Failed to send notification" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
