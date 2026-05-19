import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// APNs host — production by default. Set APNS_ENV=sandbox for local Xcode dev builds
// (which receive sandbox device tokens). TestFlight + App Store always use production.
const APNS_HOST =
  (Deno.env.get("APNS_ENV") ?? "production").toLowerCase() === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
const APNS_TOPIC = "com.familialmedia.familial";

// ---------- ES256 JWT for APNs (cached ~50 min) ----------
let cachedJwt: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - 60 > now) return cachedJwt.token;

  const keyId = Deno.env.get("APPLE_KEY_ID");
  const teamId = Deno.env.get("APPLE_ISSUER_ID");
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error("Missing APPLE_KEY_ID / APPLE_ISSUER_ID / APPLE_PRIVATE_KEY");
  }

  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: now };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const token = `${signingInput}.${b64url(sig)}`;
  cachedJwt = { token, exp: now + 50 * 60 };
  return token;
}

async function sendApns(
  deviceToken: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const jwt = await getApnsJwt();
  const res = await fetch(`${APNS_HOST}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true, status: res.status };
  let reason: string | undefined;
  try {
    const j = await res.json();
    reason = j?.reason;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, reason };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();
    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: "Missing notification record" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { user_id, title, message, link, type } = record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Respect notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("push_enabled, muted_types")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefs) {
      if (!prefs.push_enabled) {
        return new Response(JSON.stringify({ skipped: true, reason: "push disabled" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (
        prefs.muted_types &&
        Array.isArray(prefs.muted_types) &&
        type &&
        prefs.muted_types.includes(type)
      ) {
        return new Response(JSON.stringify({ skipped: true, reason: `type "${type}" muted` }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("device_token")
      .eq("user_id", user_id);

    if (tokenError) {
      console.error("fetch tokens error:", tokenError);
      return new Response(JSON.stringify({ error: "Failed to fetch tokens" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no tokens" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const apnsPayload = {
      aps: {
        alert: { title: title || "Familial", body: message || "" },
        sound: "default",
      },
      type: type || "general",
      link: link || null,
    };

    const invalidTokens: string[] = [];
    let sent = 0;

    for (const t of tokens as { device_token: string }[]) {
      try {
        const result = await sendApns(t.device_token, apnsPayload);
        if (result.ok) {
          sent++;
        } else {
          console.warn(`APNs ${result.status} for token ${t.device_token.slice(0, 8)}…: ${result.reason}`);
          if (result.status === 410 || result.reason === "Unregistered") {
            invalidTokens.push(t.device_token);
          }
        }
      } catch (e) {
        console.error("APNs send threw:", e);
      }
    }

    if (invalidTokens.length > 0) {
      await supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", user_id)
        .in("device_token", invalidTokens);
      console.log(`Cleaned ${invalidTokens.length} invalid token(s)`);
    }

    return new Response(JSON.stringify({ success: true, sent, cleaned: invalidTokens.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-push-notification error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
