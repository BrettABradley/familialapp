import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-trigger-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// APNs host — production by default. Set APNS_ENV=sandbox for local Xcode dev builds
// (which receive sandbox device tokens). TestFlight + App Store always use production.
const APNS_HOST =
  (Deno.env.get("APNS_ENV") ?? "production").toLowerCase() === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
const APNS_TOPIC = "space.manus.familial.mobile.t20260223211425";

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

// ---------- FCM HTTP v1 (Android) ----------
let cachedFcm: { token: string; exp: number } | null = null;

function pemToPkcs8Rsa(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcm && cachedFcm.exp - 60 > now) return cachedFcm.token;

  const rawJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!rawJson) throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set (used for FCM)");
  const sa = JSON.parse(rawJson);

  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8Rsa(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM OAuth error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedFcm = { token: json.access_token, exp: now + json.expires_in };
  return cachedFcm.token;
}

async function sendFcm(
  deviceToken: string,
  payload: { title: string; body: string; type: string; link: string | null },
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!projectId) return { ok: false, status: 0, reason: "FCM_PROJECT_ID missing" };
  const accessToken = await getFcmAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    token: deviceToken,
    notification: { title: payload.title, body: payload.body },
    android: {
      priority: "HIGH" as const,
      notification: { channel_id: "family_activity", sound: "default" },
    },
    data: {
      type: payload.type,
      ...(payload.link ? { link: payload.link } : {}),
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (res.ok) return { ok: true, status: res.status };
  let reason: string | undefined;
  try {
    const j = await res.json();
    reason = j?.error?.status ?? j?.error?.message;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, reason };
}


function decodeJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function isServiceRoleCaller(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  if (decodeJwtRole(authHeader) === "service_role") return true;
  const token = authHeader.slice(7).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!serviceKey && token === serviceKey;
}

// Constant-time comparison so a timing attack can't probe the secret.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isTriggerSecretCaller(req: Request): Promise<boolean> {
  const header = req.headers.get("x-trigger-secret");
  if (!header) return false;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data, error } = await admin.rpc("get_trigger_secret", {
      _key: "push_trigger_secret",
    });
    if (error || !data) {
      console.error("get_trigger_secret rpc error:", error);
      return false;
    }
    return timingSafeEqual(header, String(data));
  } catch (e) {
    console.error("isTriggerSecretCaller threw:", e);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // === Auth gate: service_role bearer OR DB-trigger shared secret header ===
  if (
    !isServiceRoleCaller(req.headers.get("Authorization")) &&
    !(await isTriggerSecretCaller(req))
  ) {
    console.warn("send-push-notification: unauthorized caller");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    const { record } = await req.json();
    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: "Missing notification record" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { id: notificationId, user_id, title, message, link, type } = record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      SERVICE_KEY
    );

    // Respect notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("push_enabled, muted_types")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefs) {
      if (!prefs.push_enabled) {
        console.log(`[push] skip notif=${notificationId} user=${user_id} reason=push_disabled`);
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
        console.log(`[push] skip notif=${notificationId} user=${user_id} reason=type_muted type=${type}`);
        return new Response(JSON.stringify({ skipped: true, reason: `type "${type}" muted` }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("device_token, platform")
      .eq("user_id", user_id);

    console.log(`[push] dispatch notif=${notificationId} user=${user_id} tokens=${tokens?.length ?? 0} type=${type}`);

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
    const fcmPayload = {
      title: title || "Familial",
      body: message || "",
      type: type || "general",
      link: link || null,
    };

    const invalidTokens: string[] = [];
    let sent = 0;

    for (const t of tokens as { device_token: string; platform: string | null }[]) {
      const platform = (t.platform ?? "ios").toLowerCase();
      try {
        let result: { ok: boolean; status: number; reason?: string };
        if (platform === "android") {
          result = await sendFcm(t.device_token, fcmPayload);
          if (!result.ok) {
            console.warn(`FCM ${result.status} for token ${t.device_token.slice(0, 8)}…: ${result.reason}`);
            if (
              result.status === 404 ||
              result.reason === "NOT_FOUND" ||
              result.reason === "UNREGISTERED" ||
              result.reason === "INVALID_ARGUMENT"
            ) {
              invalidTokens.push(t.device_token);
            }
          }
        } else {
          result = await sendApns(t.device_token, apnsPayload);
          if (!result.ok) {
            console.warn(`APNs ${result.status} for token ${t.device_token.slice(0, 8)}…: ${result.reason}`);
            if (result.status === 410 || result.reason === "Unregistered") {
              invalidTokens.push(t.device_token);
            }
          }
        }
        if (result.ok) sent++;
      } catch (e) {
        console.error("push send threw:", e);
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

    console.log(`[push] result sent=${sent} cleaned=${invalidTokens.length} total=${tokens.length}`);
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
