import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Reuse service role key as HMAC secret — never leaves the server.
const SECRET = SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function computeToken(email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.toLowerCase().trim()));
  // URL-safe base64
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyToken(email: string, token: string): Promise<boolean> {
  const expected = await computeToken(email);
  // constant-time compare
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // GET: validate token (used by frontend page to confirm link is valid before showing confirm button)
    if (req.method === "GET") {
      const email = (url.searchParams.get("email") || "").trim().toLowerCase();
      const token = (url.searchParams.get("token") || "").trim();

      if (!email || !token) {
        return new Response(JSON.stringify({ valid: false, error: "Missing email or token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ok = await verifyToken(email, token);
      if (!ok) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Already unsubscribed?
      const { data: existing } = await supabase
        .from("email_unsubscribes")
        .select("email, unsubscribed_at")
        .eq("email", email)
        .maybeSingle();

      return new Response(JSON.stringify({ valid: true, email, alreadyUnsubscribed: !!existing }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: actually unsubscribe.
    // Supports two formats:
    //  - JSON body { email, token } from our frontend page
    //  - Gmail one-click: form-encoded "List-Unsubscribe=One-Click" with email+token in query string
    if (req.method === "POST") {
      let email = (url.searchParams.get("email") || "").trim().toLowerCase();
      let token = (url.searchParams.get("token") || "").trim();
      let source = "page";

      const contentType = req.headers.get("content-type") || "";
      if (!email || !token) {
        if (contentType.includes("application/json")) {
          const body = await req.json().catch(() => ({}));
          email = String(body.email || "").trim().toLowerCase();
          token = String(body.token || "").trim();
        }
      } else {
        // Query-string variant — likely Gmail one-click
        source = "one-click";
      }

      if (!email || !token) {
        return new Response(JSON.stringify({ error: "Missing email or token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ok = await verifyToken(email, token);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: upsertError } = await supabase
        .from("email_unsubscribes")
        .upsert({ email, source }, { onConflict: "email" });

      if (upsertError) {
        console.error("Unsubscribe upsert error:", upsertError);
        return new Response(JSON.stringify({ error: "Failed to unsubscribe" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, email }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Unsubscribe error:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
