import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APNS_HOST =
  (Deno.env.get("APNS_ENV") ?? "production").toLowerCase() === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
const APNS_TOPIC = "com.familialmedia.familial";

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

async function sendApns(deviceToken: string, payload: Record<string, unknown>) {
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
  let reason: string | undefined;
  if (!res.ok) {
    try { reason = (await res.json())?.reason; } catch { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, reason };
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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokens, error: tokenErr } = await admin
      .from("push_tokens")
      .select("device_token")
      .eq("user_id", user.id);

    if (tokenErr) {
      return new Response(JSON.stringify({ error: "fetch_tokens_failed", detail: tokenErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "no_tokens_registered",
          hint: "Your device has never successfully registered with APNs. " +
            "This usually means the Push Notifications capability is missing in Xcode " +
            "(Signing & Capabilities → + Capability → Push Notifications), or you have " +
            "not yet granted push permission on this device.",
          token_count: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload = {
      aps: {
        alert: { title: "Familial test push", body: "If you see this, push is working ✅" },
        sound: "default",
      },
      type: "self_test",
      link: "/notifications",
    };

    const results: Array<{ token_prefix: string; ok: boolean; status: number; reason?: string }> = [];
    const invalidTokens: string[] = [];

    for (const t of tokens as { device_token: string }[]) {
      const r = await sendApns(t.device_token, payload);
      results.push({ token_prefix: t.device_token.slice(0, 8) + "…", ...r });
      if (
        r.status === 410 ||
        r.reason === "BadDeviceToken" ||
        r.reason === "Unregistered" ||
        r.reason === "DeviceTokenNotForTopic"
      ) {
        invalidTokens.push(t.device_token);
      }
    }

    if (invalidTokens.length > 0) {
      await admin.from("push_tokens").delete().eq("user_id", user.id).in("device_token", invalidTokens);
    }

    const anyOk = results.some((r) => r.ok);
    return new Response(
      JSON.stringify({
        ok: anyOk,
        token_count: tokens.length,
        sent: results.filter((r) => r.ok).length,
        cleaned_invalid: invalidTokens.length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("push-self-test error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
