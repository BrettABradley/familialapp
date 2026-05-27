import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requestBody = await req.json();
    const validation = validateInviteInput(requestBody);
    
    if (!validation.valid || !validation.data) {
      console.error("Validation failed:", validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const { email, circleName, inviterName, circleId } = validation.data;

    // Check if user is already a member or owner, or has a pending invite
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // AUTHORIZATION: the caller must be a member or owner of the target circle.
    // Prevents authenticated users from sending invites for arbitrary circles.
    const { data: isMember, error: memberCheckError } = await supabaseAdmin
      .rpc("is_circle_member", { _user_id: user.id, _circle_id: circleId });
    if (memberCheckError) {
      console.error("Membership check failed:", memberCheckError);
      return new Response(JSON.stringify({ error: "Failed to verify circle membership" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!isMember) {
      return new Response(JSON.stringify({ error: "You are not a member of this circle" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Look up user by email using admin API
    const { data: authUser } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = authUser?.users?.find((u) => u.email === email);

    if (targetUser) {
      // Check if already a member
      const { data: membership } = await supabaseAdmin
        .from("circle_memberships")
        .select("id")
        .eq("circle_id", circleId)
        .eq("user_id", targetUser.id)
        .maybeSingle();

      if (membership) {
        return new Response(JSON.stringify({ error: "This person is already a member of this circle" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Check if they own the circle
      const { data: ownedCircle } = await supabaseAdmin
        .from("circles")
        .select("id")
        .eq("id", circleId)
        .eq("owner_id", targetUser.id)
        .maybeSingle();

      if (ownedCircle) {
        return new Response(JSON.stringify({ error: "This person is the owner of this circle" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabaseAdmin
      .from("circle_invites")
      .select("id")
      .eq("circle_id", circleId)
      .eq("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: "A pending invite already exists for this email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if the recipient previously unsubscribed
    const { data: unsub } = await supabaseAdmin
      .from("email_unsubscribes")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (unsub) {
      return new Response(JSON.stringify({ error: "This email address has unsubscribed from Familial invites." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate HMAC-signed unsubscribe token (matches handle-unsubscribe edge function)
    const unsubKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", unsubKey, new TextEncoder().encode(email.toLowerCase().trim()));
    const unsubToken = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const unsubUrl = `https://familialmedia.com/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubToken}`;
    const fnUnsubUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(email)}&token=${unsubToken}`;

    const safeCircleName = escapeHtml(circleName);
    const safeInviterName = escapeHtml(inviterName || "A family member");
    const safeEmail = escapeHtml(email);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service is not configured. Please contact support." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending invite to ${email} for circle ${circleName}`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Familial <support@support.familialmedia.com>",
        to: [email],
        reply_to: "support@familialmedia.com",
        subject: `You're invited to join ${safeCircleName} on Familial`,
        headers: {
          "List-Unsubscribe": `<${fnUnsubUrl}>, <${unsubUrl}>, <mailto:support@familialmedia.com?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        text: `You're invited to join ${circleName} on Familial\n\n${inviterName || "A family member"} has invited you to join their family circle "${circleName}" on Familial.\n\nFamilial is a private space for families to share photos, events, messages, and memories together.\n\nJoin here: https://familialmedia.com/auth\n\nOnce you sign up with this email address (${email}), you'll automatically be connected to the circle.\n\nIf you weren't expecting this invitation, you can safely ignore this email.\n\nUnsubscribe: ${unsubUrl}\n\n© Familial — Connecting families everywhere`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;"><div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;"><div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><h1 style="color: #1a1a1a; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">You're invited</h1><p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"><strong>${safeInviterName}</strong> has invited you to join their family circle <strong>"${safeCircleName}"</strong> on Familial.</p><p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">Familial is a private space for families to share photos, events, messages, and memories together.</p><div style="text-align: center; margin: 30px 0;"><a href="https://familialmedia.com/auth" style="display: inline-block; background-color: #1a1a1a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Join Familial</a></div><p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; border-top: 1px solid #eee; padding-top: 20px;">Once you sign up with this email address (${safeEmail}), you'll automatically be connected to the circle.</p><p style="color: #999; font-size: 12px; line-height: 1.5; margin: 16px 0 0 0;">If you weren't expecting this invitation, you can safely ignore this email.</p></div><p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">© Familial — Connecting families everywhere · <a href="${unsubUrl}" style="color: #999; text-decoration: underline;">Unsubscribe</a></p></div></body></html>`,
      }),
    });

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", result);
      return new Response(JSON.stringify({ error: result.message || "Failed to send email via Resend" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Email sent successfully:", result);

    // Only insert invite record after email sends successfully
    const { error: insertError } = await supabaseAdmin
      .from("circle_invites")
      .insert({
        circle_id: circleId,
        invited_by: user.id,
        email: email,
        status: "pending",
      });

    if (insertError) {
      console.error("Failed to save invite record:", insertError);
      // Email was sent but DB insert failed — still return success since the email went out
      return new Response(JSON.stringify({ success: true, warning: "Email sent but invite record failed to save" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending invite email:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
