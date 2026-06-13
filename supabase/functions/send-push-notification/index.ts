import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-trigger-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// APNs host — production by default. Set APNS_ENV=sandbox for local Xcode dev builds.
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

async function mintApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
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
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${b64url(sig)}`;
  cachedJwt = { token, exp: now + 50 * 60 };
  return token;
}

async function getApnsJwt(forceRefresh = false): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && cachedJwt && cachedJwt.exp - 60 > now) return cachedJwt.token;
  return await mintApnsJwt();
}

type SendResult = { ok: boolean; status: number; reason?: string; attempts: number };

const APNS_TRANSIENT = new Set([429, 500, 502, 503, 504]);
const FCM_TRANSIENT_REASONS = new Set(["UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"]);

function backoffMs(attempt: number): number {
  // 250ms, 1s, 2s
  return [250, 1000, 2000][attempt] ?? 2000;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendApns(
  deviceToken: string,
  payload: Record<string, unknown>,
): Promise<SendResult> {
  let attempts = 0;
  let credRefreshed = false;
  for (let i = 0; i < 3; i++) {
    attempts++;
    try {
      const jwt = await getApnsJwt();
      const res = await fetchWithTimeout(
        `${APNS_HOST}/3/device/${deviceToken}`,
        {
          method: "POST",
          headers: {
            authorization: `bearer ${jwt}`,
            "apns-topic": APNS_TOPIC,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        8000,
      );
      if (res.ok) return { ok: true, status: res.status, attempts };

      let reason: string | undefined;
      try {
        const j = await res.json();
        reason = j?.reason;
      } catch { /* ignore */ }

      // Auth failure: bust JWT cache once, retry
      if (!credRefreshed && (res.status === 403) &&
          (reason === "InvalidProviderToken" || reason === "ExpiredProviderToken")) {
        cachedJwt = null;
        credRefreshed = true;
        continue;
      }
      if (APNS_TRANSIENT.has(res.status) && i < 2) {
        await new Promise((r) => setTimeout(r, backoffMs(i)));
        continue;
      }
      return { ok: false, status: res.status, reason, attempts };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "network_error";
      if (i < 2) {
        await new Promise((r) => setTimeout(r, backoffMs(i)));
        continue;
      }
      return { ok: false, status: 0, reason, attempts };
    }
  }
  return { ok: false, status: 0, reason: "exhausted", attempts };
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

async function mintFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
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

async function getFcmAccessToken(forceRefresh = false): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && cachedFcm && cachedFcm.exp - 60 > now) return cachedFcm.token;
  return await mintFcmAccessToken();
}

async function sendFcm(
  deviceToken: string,
  payload: { title: string; body: string; type: string; link: string | null },
): Promise<SendResult> {
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!projectId) return { ok: false, status: 0, reason: "FCM_PROJECT_ID missing", attempts: 0 };
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

  let attempts = 0;
  let credRefreshed = false;
  for (let i = 0; i < 3; i++) {
    attempts++;
    try {
      const accessToken = await getFcmAccessToken();
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }, 8000);
      if (res.ok) return { ok: true, status: res.status, attempts };
      let reason: string | undefined;
      try {
        const j = await res.json();
        reason = j?.error?.status ?? j?.error?.message;
      } catch { /* ignore */ }

      if (!credRefreshed && (res.status === 401 || reason === "UNAUTHENTICATED")) {
        cachedFcm = null;
        credRefreshed = true;
        continue;
      }
      const transient = res.status >= 500 || res.status === 429 ||
        (reason && FCM_TRANSIENT_REASONS.has(reason));
      if (transient && i < 2) {
        await new Promise((r) => setTimeout(r, backoffMs(i)));
        continue;
      }
      return { ok: false, status: res.status, reason, attempts };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "network_error";
      if (i < 2) {
        await new Promise((r) => setTimeout(r, backoffMs(i)));
        continue;
      }
      return { ok: false, status: 0, reason, attempts };
    }
  }
  return { ok: false, status: 0, reason: "exhausted", attempts };
}

function decodeJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

// ----- helpers for delivery log + token housekeeping -----

async function logDelivery(
  admin: ReturnType<typeof createClient>,
  rows: Array<{
    notification_id: string | null;
    user_id: string;
    platform: string;
    status: string;
    reason?: string;
    attempts: number;
  }>,
) {
  if (!rows.length) return;
  try {
    await admin.from("push_delivery_log").insert(rows);
  } catch (e) {
    console.error("push_delivery_log insert failed:", e);
  }
}

async function maybeNotifyAdmins(
  admin: ReturnType<typeof createClient>,
  reason: string,
) {
  // Debounce: only alert if no cred_failure log row in the last hour
  try {
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("push_delivery_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "cred_failure")
      .gte("created_at", hourAgo);
    if ((count ?? 0) > 1) return; // we already inserted this attempt's row
    const { data: admins } = await admin
      .from("platform_admins")
      .select("user_id");
    if (!admins?.length) return;
    const rows = admins.map((a: { user_id: string }) => ({
      user_id: a.user_id,
      type: "system_alert",
      title: "Push credentials failing",
      message: `Push provider returned auth error: ${reason}. Re-check APPLE_KEY_ID / APPLE_ISSUER_ID (Team ID) / APPLE_PRIVATE_KEY.`,
      link: "/more",
    }));
    await admin.from("notifications").insert(rows);
  } catch (e) {
    console.error("maybeNotifyAdmins failed:", e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", SERVICE_KEY);

  try {
    const { record } = await req.json();
    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: "Missing notification record" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { id: notificationId, user_id, title, message, link, type } = record;

    // Respect notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("push_enabled, muted_types")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefs) {
      if (!prefs.push_enabled) {
        await logDelivery(supabase, [{
          notification_id: notificationId ?? null,
          user_id, platform: "n/a", status: "skipped_pref", reason: "push_disabled", attempts: 0,
        }]);
        return new Response(JSON.stringify({ skipped: true, reason: "push disabled" }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (prefs.muted_types && Array.isArray(prefs.muted_types) && type && prefs.muted_types.includes(type)) {
        await logDelivery(supabase, [{
          notification_id: notificationId ?? null,
          user_id, platform: "n/a", status: "skipped_pref", reason: `type_muted:${type}`, attempts: 0,
        }]);
        return new Response(JSON.stringify({ skipped: true, reason: `type "${type}" muted` }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
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
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no tokens" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const apnsPayload = {
      aps: { alert: { title: title || "Familial", body: message || "" }, sound: "default" },
      type: type || "general",
      link: link || null,
    };
    const fcmPayload = {
      title: title || "Familial",
      body: message || "",
      type: type || "general",
      link: link || null,
    };

    type Token = { device_token: string; platform: string | null };
    const list = tokens as Token[];

    // Parallel with concurrency cap of 10
    const CONCURRENCY = 10;
    const results: Array<{ token: Token; result: SendResult }> = new Array(list.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= list.length) return;
        const t = list[idx];
        const platform = (t.platform ?? "ios").toLowerCase();
        let result: SendResult;
        try {
          result = platform === "android"
            ? await sendFcm(t.device_token, fcmPayload)
            : await sendApns(t.device_token, apnsPayload);
        } catch (e) {
          result = { ok: false, status: 0, reason: e instanceof Error ? e.message : "threw", attempts: 1 };
        }
        results[idx] = { token: t, result };
      }
    });
    await Promise.all(workers);

    const invalidTokens: string[] = [];
    const successTokens: string[] = [];
    const logRows: Parameters<typeof logDelivery>[1] = [];
    let sent = 0;
    let credFailure: string | null = null;

    for (const { token: t, result } of results) {
      const platform = (t.platform ?? "ios").toLowerCase();
      const isInvalid =
        (platform === "android" && (result.status === 404 || result.reason === "NOT_FOUND" || result.reason === "UNREGISTERED" || result.reason === "INVALID_ARGUMENT")) ||
        (platform !== "android" && (result.status === 410 || result.reason === "Unregistered" || result.reason === "BadDeviceToken"));

      const isCredFail = !result.ok &&
        (result.reason === "InvalidProviderToken" || result.reason === "ExpiredProviderToken" ||
         result.reason === "UNAUTHENTICATED" || result.status === 401);

      if (result.ok) {
        sent++;
        successTokens.push(t.device_token);
        logRows.push({
          notification_id: notificationId ?? null,
          user_id, platform, status: "sent", attempts: result.attempts,
        });
      } else if (isInvalid) {
        invalidTokens.push(t.device_token);
        logRows.push({
          notification_id: notificationId ?? null,
          user_id, platform, status: "invalid_token",
          reason: `${result.status}:${result.reason ?? ""}`, attempts: result.attempts,
        });
      } else if (isCredFail) {
        credFailure = result.reason ?? `status_${result.status}`;
        logRows.push({
          notification_id: notificationId ?? null,
          user_id, platform, status: "cred_failure",
          reason: `${result.status}:${result.reason ?? ""}`, attempts: result.attempts,
        });
      } else {
        logRows.push({
          notification_id: notificationId ?? null,
          user_id, platform, status: "failed",
          reason: `${result.status}:${result.reason ?? ""}`, attempts: result.attempts,
        });
      }
    }

    // Persist log + housekeeping
    await logDelivery(supabase, logRows);

    if (successTokens.length > 0) {
      await supabase
        .from("push_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .in("device_token", successTokens);
    }

    if (invalidTokens.length > 0) {
      await supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", user_id)
        .in("device_token", invalidTokens);
      console.log(`Cleaned ${invalidTokens.length} invalid token(s)`);
    }

    if (credFailure) {
      await maybeNotifyAdmins(supabase, credFailure);
    }

    console.log(`[push] result sent=${sent} cleaned=${invalidTokens.length} cred=${credFailure ?? "ok"} total=${list.length}`);
    return new Response(
      JSON.stringify({ success: true, sent, cleaned: invalidTokens.length, cred_failure: credFailure }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-push-notification error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
