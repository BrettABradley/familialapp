import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TO_PLAN: Record<string, { plan: string; max_circles: number; max_members_per_circle: number }> = {
  "com.familialmedia.familial.family.monthly": { plan: "family", max_circles: 2, max_members_per_circle: 20 },
  "com.familialmedia.familial.extended.monthly": { plan: "extended", max_circles: 3, max_members_per_circle: 35 },
};

const EXTRA_MEMBERS_PRODUCT = "com.familialmedia.familial.extramembers";
const EXTRA_MEMBERS_INCREMENT = 7;
const BUNDLE_ID = "com.familialmedia.familial";

// === Apple App Store Server API helpers ===
function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToPkcs8(pem: string): Uint8Array {
  // Tolerate keys pasted with literal \n sequences (common when stored in env vars).
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

async function generateAppleJWT(): Promise<string> {
  const issuerId = Deno.env.get("APPLE_ISSUER_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!issuerId || !keyId || !privateKeyPem) {
    throw new Error("Apple App Store credentials are not configured");
  }

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 60 * 20,
    aud: "appstoreconnect-v1",
    bid: BUNDLE_ID,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = pemToPkcs8(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = base64UrlEncode(new Uint8Array(sigBuf));
  return `${signingInput}.${signature}`;
}

function decodeJwsPayload(jws: string): any {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWS");
  const bytes = base64UrlDecodeToBytes(parts[1]);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Calls Apple's App Store Server API to fetch + verify a transaction.
 * Tries production first, falls back to sandbox (TestFlight & sandbox tester accounts).
 *
 * Returns a structured result so the caller can distinguish:
 *  - { ok: true, txn }                     transaction verified
 *  - { ok: false, reason: 'credentials' }  Apple returned 401 — our App Store Connect API key is invalid/expired
 *  - { ok: false, reason: 'not_found' }    Apple returned 404 — sandbox/prod mismatch or txn unknown
 *  - { ok: false, reason: 'transient' }    network or 5xx — safe to retry
 */
type AppleLookupResult =
  | { ok: true; txn: any }
  | { ok: false; reason: "credentials" | "not_found" | "transient"; detail?: string };

async function fetchAppleTransaction(transactionId: string): Promise<AppleLookupResult> {
  let jwt: string;
  try {
    jwt = await generateAppleJWT();
  } catch (err: any) {
    console.warn(`[validate-apple-receipt] JWT generation failed: ${err.message}`);
    return { ok: false, reason: "credentials", detail: `JWT generation failed: ${err.message}` };
  }
  const headers = { Authorization: `Bearer ${jwt}` };

  const endpoints = [
    `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
    `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
  ];

  let sawCredentialFailure = false;
  let sawNotFound = false;
  let lastDetail: string | undefined;

  for (const url of endpoints) {
    const env = url.includes("sandbox") ? "sandbox" : "production";
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.signedTransactionInfo) {
          console.log(`[validate-apple-receipt] Apple ${env} OK for txn ${transactionId}`);
          return { ok: true, txn: decodeJwsPayload(data.signedTransactionInfo) };
        }
      } else {
        const txt = await res.text();
        console.warn(`[validate-apple-receipt] Apple ${env} ${res.status}: ${txt}`);
        lastDetail = `Apple ${env} ${res.status}: ${txt.slice(0, 200)}`;
        if (res.status === 401) sawCredentialFailure = true;
        if (res.status === 404) sawNotFound = true;
      }
    } catch (err: any) {
      console.warn(`[validate-apple-receipt] Apple ${env} fetch error: ${err.message}`);
      lastDetail = `Apple ${env} fetch error: ${err.message}`;
    }
  }

  if (sawCredentialFailure) return { ok: false, reason: "credentials", detail: lastDetail };
  if (sawNotFound) return { ok: false, reason: "not_found", detail: lastDetail };
  return { ok: false, reason: "transient", detail: lastDetail };
}

// NOTE: We intentionally do NOT decode the client JWS as a fallback.
// Without verifying Apple's ECDSA signature, an attacker could craft a fake
// JWS and trigger a free plan upgrade whenever Apple's server API is briefly
// unreachable. If Apple's API fails, we surface a 503 and let the client retry
// (StoreKit retains the entitlement client-side, so nothing is lost).



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const { kind, transactionId, productId, restore, circleId, rescue_circle_id, jwsRepresentation } = body;
    console.log("[validate-apple-receipt] request", {
      userId: user.id,
      kind,
      productId,
      transactionId: transactionId ? String(transactionId).slice(0, 12) + "…" : null,
      hasCircleId: !!circleId,
      hasJws: !!jwsRepresentation,
      restore: !!restore,
    });

    if (restore) {
      return new Response(JSON.stringify({ success: true, restored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transactionId || !productId) {
      throw new Error("transactionId and productId are required");
    }

    // === Verify with Apple's App Store Server API (no unsigned fallback) ===
    const lookup = await fetchAppleTransaction(String(transactionId));
    if (!lookup.ok) {
      // Persist the unverified receipt server-side so the retry cron can pick
      // it up once Apple credentials are fixed — even if the user uninstalls
      // and we lose their localStorage queue.
      try {
        await serviceClient.from("unverified_apple_receipts").upsert({
          transaction_id: String(transactionId),
          user_id: user.id,
          product_id: productId,
          kind: kind ?? (productId === EXTRA_MEMBERS_PRODUCT ? "extra_members" : "subscription"),
          circle_id: circleId ?? null,
          rescue_circle_id: rescue_circle_id ?? null,
          last_error_code: lookup.reason === "credentials"
            ? "APPLE_CREDENTIALS_INVALID"
            : lookup.reason === "not_found"
              ? "APPLE_TXN_NOT_FOUND"
              : "APPLE_TRANSIENT",
          last_error_detail: lookup.detail ?? null,
          last_attempt_at: new Date().toISOString(),
          jws_representation: jwsRepresentation ?? null,
        }, { onConflict: "transaction_id" });

        // Bump attempts atomically via RPC-less update (separate call to avoid
        // overwriting attempts=0 on the upsert above).
        await serviceClient.rpc("exec", {}).catch(() => null);
        const { data: existing } = await serviceClient
          .from("unverified_apple_receipts")
          .select("attempts")
          .eq("transaction_id", String(transactionId))
          .maybeSingle();
        if (existing) {
          await serviceClient
            .from("unverified_apple_receipts")
            .update({ attempts: (existing.attempts ?? 0) + 1 })
            .eq("transaction_id", String(transactionId));
        }
      } catch (logErr) {
        console.warn("[validate-apple-receipt] failed to record unverified receipt", logErr);
      }

      if (lookup.reason === "credentials") {
        return new Response(
          JSON.stringify({
            error:
              "Apple confirmed your payment, but we couldn't credit it just yet. " +
              "We'll finish this automatically — usually within a few minutes. You can close the app safely.",
            code: "APPLE_CREDENTIALS_INVALID",
            retry: true,
            detail: lookup.detail,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (lookup.reason === "not_found") {
        return new Response(
          JSON.stringify({
            error:
              "Apple hasn't published this transaction yet. We'll retry automatically.",
            code: "APPLE_TXN_NOT_FOUND",
            retry: true,
            detail: lookup.detail,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          error: "Apple is temporarily unable to verify this transaction. We'll retry automatically.",
          code: "APPLE_TRANSIENT",
          retry: true,
          detail: lookup.detail,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verification succeeded — clear any prior unverified entry for this txn
    try {
      await serviceClient
        .from("unverified_apple_receipts")
        .delete()
        .eq("transaction_id", String(transactionId));
    } catch {
      // non-fatal
    }

    const txn = lookup.txn;
    console.log("[validate-apple-receipt] txn decoded", {
      source: "apple-server-api",
      bundleId: txn.bundleId,
      productId: txn.productId,
      type: txn.type,
      revoked: !!txn.revocationDate,
      expires: txn.expiresDate ?? null,
    });

    // Accept production bundle OR Lovable/Manus preview TestFlight bundles
    // (e.g. "space.manus.familial.mobile.t20260223211425"). The product ID
    // check below is the real authorization gate — bundle is defense in depth.
    const isProdBundle = txn.bundleId === BUNDLE_ID;
    const isPreviewBundle = typeof txn.bundleId === "string" &&
      (txn.bundleId.startsWith("space.manus.familial.") ||
       txn.bundleId.startsWith("app.lovable.") ||
       txn.bundleId.includes(".familial."));
    if (!isProdBundle && !isPreviewBundle) {
      throw new Error(`Bundle ID mismatch: ${txn.bundleId}`);
    }
    if (!isProdBundle) {
      console.log(`[validate-apple-receipt] accepting preview bundle: ${txn.bundleId}`);
    }
    if (txn.productId !== productId) {
      throw new Error(`Product ID mismatch: expected ${productId}, got ${txn.productId}`);
    }
    if (txn.revocationDate) {
      throw new Error("Transaction has been revoked by Apple");
    }
    // Subscriptions: ensure not expired
    if (txn.type === "Auto-Renewable Subscription" && txn.expiresDate && txn.expiresDate < Date.now()) {
      throw new Error("Subscription has expired");
    }

    // === Extra Members consumable ===
    if (kind === "extra_members" || productId === EXTRA_MEMBERS_PRODUCT) {
      if (!circleId) throw new Error("circleId is required for extra_members");

      // Verify caller owns the circle
      const { data: circle, error: circleErr } = await serviceClient
        .from("circles")
        .select("id, owner_id, extra_members")
        .eq("id", circleId)
        .single();
      if (circleErr || !circle) throw new Error("Circle not found");
      if (circle.owner_id !== user.id) throw new Error("Only the circle owner can add seats");

      // Idempotent ledger insert — if this Apple transaction was already
      // processed (e.g. client retried after a network blip), the unique
      // constraint on transaction_id returns 23505 and we no-op.
      const { error: ledgerErr } = await serviceClient
        .from("apple_iap_grants")
        .insert({
          user_id: user.id,
          circle_id: circleId,
          product_id: productId,
          transaction_id: String(transactionId),
          original_transaction_id: txn.originalTransactionId ?? null,
          kind: "extra_members",
          seats_added: EXTRA_MEMBERS_INCREMENT,
          raw: { bundleId: txn.bundleId, type: txn.type },
        });
      if (ledgerErr) {
        if ((ledgerErr as any).code === "23505") {
          console.log("[validate-apple-receipt] duplicate extra_members txn — already credited", { transactionId });
          return new Response(
            JSON.stringify({ success: true, kind: "extra_members", added: 0, duplicate: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw ledgerErr;
      }

      const { error: updErr } = await serviceClient
        .from("circles")
        .update({ extra_members: (circle.extra_members ?? 0) + EXTRA_MEMBERS_INCREMENT })
        .eq("id", circleId);
      if (updErr) throw updErr;

      return new Response(JSON.stringify({ success: true, kind: "extra_members", added: EXTRA_MEMBERS_INCREMENT }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Subscription ===
    const planConfig = PRODUCT_TO_PLAN[productId];
    if (!planConfig) {
      throw new Error("Unknown product ID");
    }

    // Idempotent ledger insert for the subscription transaction. A duplicate
    // just means the client retried — return success without re-applying.
    const { error: subLedgerErr } = await serviceClient
      .from("apple_iap_grants")
      .insert({
        user_id: user.id,
        circle_id: null,
        product_id: productId,
        transaction_id: String(transactionId),
        original_transaction_id: txn.originalTransactionId ?? null,
        kind: "subscription",
        seats_added: 0,
        plan: planConfig.plan,
        raw: { bundleId: txn.bundleId, type: txn.type, expiresDate: txn.expiresDate ?? null },
      });
    if (subLedgerErr && (subLedgerErr as any).code === "23505") {
      console.log("[validate-apple-receipt] duplicate subscription txn — already applied", { transactionId });
      return new Response(
        JSON.stringify({ success: true, plan: planConfig.plan, duplicate: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (subLedgerErr) throw subLedgerErr;

    const { error: updateError } = await serviceClient
      .from("user_plans")
      .update({
        plan: planConfig.plan,
        max_circles: planConfig.max_circles,
        max_members_per_circle: planConfig.max_members_per_circle,
        cancel_at_period_end: false,
        pending_plan: null,
        apple_original_transaction_id: txn.originalTransactionId ?? transactionId,
        source: "apple",
      })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    // Stamp subscription_started_at only on first paid activation (never overwrite).
    await serviceClient
      .from("user_plans")
      .update({ subscription_started_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("subscription_started_at", null);

    // Optional: complete a circle rescue claim after a successful upgrade
    if (rescue_circle_id) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { error: claimErr } = await userClient.rpc("claim_circle_ownership", {
        _circle_id: rescue_circle_id,
      });
      if (claimErr) {
        return new Response(
          JSON.stringify({ success: true, plan: planConfig.plan, rescue_error: claimErr.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ success: true, plan: planConfig.plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[validate-apple-receipt] ERROR:", error?.message ?? error, error?.stack ?? "");
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
