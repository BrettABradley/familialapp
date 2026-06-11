// Scheduled job: re-runs validate-apple-receipt for every receipt that
// previously failed Apple verification. Once Apple credentials are valid,
// every stuck purchase clears itself within one cron interval.
//
// Triggered by pg_cron via service-role bearer token — see migration that
// schedules this function. No user JWT is ever used here.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Limit each cron tick so we never hammer Apple if there's a backlog.
const MAX_PER_RUN = 25;
// Skip rows we touched in the last 4 minutes — give Apple a moment to publish.
const COOLDOWN_MS = 4 * 60 * 1000;

function decodeJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function isServiceRoleCaller(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  if (decodeJwtRole(authHeader) === "service_role") return true;
  return authHeader.slice(7).trim() === SERVICE_ROLE_KEY;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Must be called with a service-role bearer token (set in the cron job).
  if (!isServiceRoleCaller(req.headers.get("Authorization"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: rows, error } = await service
    .from("unverified_apple_receipts")
    .select("*")
    .lt("last_attempt_at", cutoff)
    .order("first_seen_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[retry-unverified] query failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let credited = 0;
  let stillStuck = 0;

  for (const row of rows) {
    try {
      const credited_row = await retryOne(service, row);
      if (credited_row) {
        credited += 1;
      } else {
        stillStuck += 1;
      }
    } catch (err: any) {
      console.warn("[retry-unverified] row failed", row.transaction_id, err?.message);
      stillStuck += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: rows.length, credited, stillStuck }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ---- Inline Apple verification + grant (avoids the user-auth requirement) ----

const BUNDLE_ID = "com.familialmedia.familial";
const EXTRA_MEMBERS_PRODUCT = "com.familialmedia.familial.extramembers";
const EXTRA_MEMBERS_INCREMENT = 7;
const PRODUCT_TO_PLAN: Record<string, { plan: string; max_circles: number; max_members_per_circle: number }> = {
  "com.familialmedia.familial.family.monthly": { plan: "family", max_circles: 2, max_members_per_circle: 20 },
  "com.familialmedia.familial.extended.monthly": { plan: "extended", max_circles: 3, max_members_per_circle: 35 },
};

function b64u(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64uDecode(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function appleJwt(): Promise<string | null> {
  const issuerId = Deno.env.get("APPLE_ISSUER_ID")?.trim();
  const keyId = Deno.env.get("APPLE_KEY_ID")?.trim();
  const pem = Deno.env.get("APPLE_PRIVATE_KEY")?.trim();
  if (!issuerId || !keyId || !pem) return null;
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 60 * 20, aud: "appstoreconnect-v1", bid: BUNDLE_ID };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8(pem),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
    return `${signingInput}.${b64u(new Uint8Array(sig))}`;
  } catch {
    return null;
  }
}

async function fetchTxn(transactionId: string): Promise<{ ok: true; txn: any } | { ok: false; reason: string; detail?: string }> {
  const jwt = await appleJwt();
  if (!jwt) return { ok: false, reason: "credentials", detail: "No Apple credentials" };
  const endpoints = [
    `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
    `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
  ];
  let sawCred = false, sawNF = false, last: string | undefined;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.ok) {
        const data = await res.json();
        if (data?.signedTransactionInfo) {
          const parts = data.signedTransactionInfo.split(".");
          const txn = JSON.parse(new TextDecoder().decode(b64uDecode(parts[1])));
          return { ok: true, txn };
        }
      } else {
        const txt = await res.text();
        last = `${res.status}: ${txt.slice(0, 200)}`;
        if (res.status === 401) sawCred = true;
        if (res.status === 404) sawNF = true;
      }
    } catch (e: any) {
      last = e?.message ?? String(e);
    }
  }
  if (sawCred) return { ok: false, reason: "credentials", detail: last };
  if (sawNF) return { ok: false, reason: "not_found", detail: last };
  return { ok: false, reason: "transient", detail: last };
}

async function retryOne(service: any, row: any): Promise<boolean> {
  const lookup = await fetchTxn(row.transaction_id);

  if (!lookup.ok) {
    const code = lookup.reason === "credentials" ? "APPLE_CREDENTIALS_INVALID"
      : lookup.reason === "not_found" ? "APPLE_TXN_NOT_FOUND"
      : "APPLE_TRANSIENT";
    await service.from("unverified_apple_receipts").update({
      last_error_code: code,
      last_error_detail: lookup.detail ?? null,
      last_attempt_at: new Date().toISOString(),
      attempts: (row.attempts ?? 0) + 1,
    }).eq("transaction_id", row.transaction_id);
    return false;
  }

  const txn = lookup.txn;
  const isProd = txn.bundleId === BUNDLE_ID;
  const isPreview = typeof txn.bundleId === "string" &&
    (txn.bundleId.startsWith("space.manus.familial.") ||
     txn.bundleId.startsWith("app.lovable.") ||
     txn.bundleId.includes(".familial."));
  if (!isProd && !isPreview) {
    await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
    console.warn("[retry-unverified] bundle mismatch, dropping", row.transaction_id);
    return false;
  }
  if (txn.productId !== row.product_id) {
    await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
    console.warn("[retry-unverified] product mismatch, dropping", row.transaction_id);
    return false;
  }
  if (txn.revocationDate) {
    await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
    return false;
  }

  // === Apply the grant idempotently ===
  if (row.kind === "extra_members" || row.product_id === EXTRA_MEMBERS_PRODUCT) {
    if (!row.circle_id) {
      await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
      return false;
    }
    const { data: circle } = await service.from("circles").select("id, owner_id, extra_members").eq("id", row.circle_id).single();
    if (!circle || circle.owner_id !== row.user_id) {
      await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
      return false;
    }
    const { error: ledgerErr } = await service.from("apple_iap_grants").insert({
      user_id: row.user_id,
      circle_id: row.circle_id,
      product_id: row.product_id,
      transaction_id: row.transaction_id,
      original_transaction_id: txn.originalTransactionId ?? null,
      kind: "extra_members",
      seats_added: EXTRA_MEMBERS_INCREMENT,
      raw: { bundleId: txn.bundleId, type: txn.type, source: "cron_retry" },
    });
    if (ledgerErr && (ledgerErr as any).code === "23505") {
      // Already credited — just clean up.
      await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
      return true;
    }
    if (ledgerErr) {
      console.warn("[retry-unverified] ledger insert failed", ledgerErr);
      return false;
    }
    await service.from("circles").update({
      extra_members: (circle.extra_members ?? 0) + EXTRA_MEMBERS_INCREMENT,
    }).eq("id", row.circle_id);
    await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
    console.log("[retry-unverified] credited extra_members", row.transaction_id);
    return true;
  }

  // Subscription
  const planConfig = PRODUCT_TO_PLAN[row.product_id];
  if (!planConfig) {
    await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
    return false;
  }
  const { error: subLedgerErr } = await service.from("apple_iap_grants").insert({
    user_id: row.user_id,
    circle_id: null,
    product_id: row.product_id,
    transaction_id: row.transaction_id,
    original_transaction_id: txn.originalTransactionId ?? null,
    kind: "subscription",
    seats_added: 0,
    plan: planConfig.plan,
    raw: { bundleId: txn.bundleId, type: txn.type, source: "cron_retry" },
  });
  if (subLedgerErr && (subLedgerErr as any).code === "23505") {
    await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
    return true;
  }
  if (subLedgerErr) return false;

  await service.from("user_plans").update({
    plan: planConfig.plan,
    max_circles: planConfig.max_circles,
    max_members_per_circle: planConfig.max_members_per_circle,
    cancel_at_period_end: false,
    pending_plan: null,
    apple_original_transaction_id: txn.originalTransactionId ?? row.transaction_id,
    source: "apple",
  }).eq("user_id", row.user_id);

  await service.from("user_plans")
    .update({ subscription_started_at: new Date().toISOString() })
    .eq("user_id", row.user_id)
    .is("subscription_started_at", null);

  await service.from("unverified_apple_receipts").delete().eq("transaction_id", row.transaction_id);
  console.log("[retry-unverified] credited subscription", row.transaction_id);
  return true;
}
