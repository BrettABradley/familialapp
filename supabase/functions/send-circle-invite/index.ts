import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

interface InviteRequest {
  email: string;
  circleName: string;
  inviterName: string;
  circleId: string;
}

function validateInviteInput(input: unknown): { valid: boolean; error?: string; data?: InviteRequest } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: "Invalid request body" };
  }
  
  const { email, circleName, inviterName, circleId } = input as Record<string, unknown>;
  
  if (!email || typeof email !== 'string') {
    return { valid: false, error: "Email is required" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 255) {
    return { valid: false, error: "Invalid email format" };
  }
  
  if (!circleName || typeof circleName !== 'string') {
    return { valid: false, error: "Circle name is required" };
  }
  if (circleName.length > 100) {
    return { valid: false, error: "Circle name must be less than 100 characters" };
  }
  
  if (!circleId || typeof circleId !== 'string') {
    return { valid: false, error: "Circle ID is required" };
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(circleId)) {
    return { valid: false, error: "Invalid circle ID format" };
  }
  
  const sanitizedInviterName = typeof inviterName === 'string' ? inviterName.slice(0, 100) : "";
  
  return {
    valid: true,
    data: {
      email: email.trim(),
      circleName: circleName.trim(),
      inviterName: sanitizedInviterName.trim(),
      circleId: circleId.trim(),
    }
  };
}

const handler = async (req: Request): Promise<Response> => {
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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requestBody = await req.json();
    const validation = validateInviteInput(requestBody);
    
    if (!validation.valid || !validation.data) {
      console.error("Validation failed:", validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const { email, circleName, inviterName, circleId } = validation.data;
    
    const safeCircleName = escapeHtml(circleName);
    const safeInviterName = escapeHtml(inviterName || "A family member");
    const safeEmail = escapeHtml(email);

    console.log(`Sending invite to ${email} for circle ${circleName}`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Familial <onboarding@resend.dev>",
        to: [email],
        subject: `You're invited to join ${safeCircleName} on Familial!`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;"><div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;"><div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><h1 style="color: #1a1a1a; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">You're Invited! 🎉</h1><p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"><strong>${safeInviterName}</strong> has invited you to join their family circle <strong>"${safeCircleName}"</strong> on Familial.</p><p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">Familial is a private space for families to share photos, events, messages, and memories together.</p><div style="text-align: center; margin: 30px 0;"><a href="https://familialapp.lovable.app/auth" style="display: inline-block; background-color: #1a1a1a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Join Familial</a></div><p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; border-top: 1px solid #eee; padding-top: 20px;">Once you sign up with this email address (${safeEmail}), you'll automatically be connected to the circle.</p></div><p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">© Familial - Connecting families everywhere</p></div></body></html>`,
      }),
    });

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result.message || "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending invite email:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
