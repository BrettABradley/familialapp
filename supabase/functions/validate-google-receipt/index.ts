// validate-google-receipt
// Server-side verification of a Google Play purchase token via the
// Google Play Developer API. Mirrors validate-apple-receipt: same plan
// updates, same circle-rescue handoff, same extra-members consumable flow.
//
// Requires secrets:
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  — full JSON of a service account
//                                        with "View financial data" +
//                                        "Manage orders and subscriptions"
//   GOOGLE_PLAY_PACKAGE_NAME          — usually space.manus.familial.mobile.t...
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TO_PLAN: Record<
  string,
  { plan: string; max_circles: number; max_members_per_circle: number }
> = {
  family_monthly: { plan: "family", max_circles: 2, max_members_per_circle: 20 },
  extended_monthly: { plan: "extended", max_circles: 3, max_members_per_circle: 35 },
};

const EXTRA_MEMBERS_PRODUCT = "extra_members";
const EXTRA_MEMBERS_INCREMENT = 7;

// === Google service-account JWT → OAuth bearer ===
function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  const rawJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!rawJson) throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set");
  const sa = JSON.parse(rawJson);

  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = pemToPkcs8(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(sigBuf))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google OAuth token error: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedAccessToken.token;
}

async function fetchSubscriptionPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<any | null> {
  const token = await getGoogleAccessToken();
  // v2 API used because Play deprecated v1 subscriptions endpoint for
  // newly-published apps.
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`[validate-google-receipt] subscriptions.get ${res.status}: ${await res.text()}`);
    return null;
  }
  return await res.json();
}

async function fetchProductPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<any | null> {
  const token = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`[validate-google-receipt] products.get ${res.status}: ${await res.text()}`);
    return null;
  }
  return await res.json();
}

async function acknowledgeSubscription(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const token = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}:acknowledge`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    console.warn(`[validate-google-receipt] acknowledge ${res.status}: ${await res.text()}`);
  }
}

async function consumePurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const token = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}:consume`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    console.warn(`[validate-google-receipt] consume ${res.status}: ${await res.text()}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const { kind, productId, purchaseToken, restore, circleId, rescue_circle_id } = body;
    const packageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "";
    if (!packageName) throw new Error("GOOGLE_PLAY_PACKAGE_NAME is not set");

    console.log("[validate-google-receipt] request", {
      userId: user.id,
      kind,
      productId,
      hasPurchaseToken: !!purchaseToken,
      hasCircleId: !!circleId,
      restore: !!restore,
    });

    if (restore) {
      return new Response(JSON.stringify({ success: true, restored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!productId || !purchaseToken) {
      throw new Error("productId and purchaseToken are required");
    }

    // === Idempotency: check google_iap_grants ledger ===
    // If we've already credited this purchase_token, return success without
    // re-running the plan/circle mutation. Mirrors apple_iap_grants and makes
    // client-side retry queues safe (network blip + relaunch = no double-grant).
    const { data: priorGrant } = await serviceClient
      .from("google_iap_grants")
      .select("id, kind, product_id, granted_at")
      .eq("purchase_token", purchaseToken)
      .maybeSingle();

    if (priorGrant) {
      console.log("[validate-google-receipt] duplicate purchase_token — returning prior grant", {
        userId: user.id,
        productId,
        grantedAt: priorGrant.granted_at,
      });
      return new Response(
        JSON.stringify({ success: true, duplicate: true, kind: priorGrant.kind }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === Extra Members consumable ===
    if (kind === "extra_members" || productId === EXTRA_MEMBERS_PRODUCT) {
      if (!circleId) throw new Error("circleId is required for extra_members");

      const purchase = await fetchProductPurchase(packageName, productId, purchaseToken);
      if (!purchase) {
        return new Response(
          JSON.stringify({
            error: "Google is temporarily unable to verify this purchase. Please try again.",
            retry: true,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
      if (purchase.purchaseState !== 0) {
        throw new Error(`Purchase is not in purchased state (state=${purchase.purchaseState})`);
      }

      const { data: circle, error: circleErr } = await serviceClient
        .from("circles")
        .select("id, owner_id, extra_members")
        .eq("id", circleId)
        .single();
      if (circleErr || !circle) throw new Error("Circle not found");
      if (circle.owner_id !== user.id) throw new Error("Only the circle owner can add seats");

      // Gate: owner must have an active paid/comped/store subscription.
      // Existing extras already on the circle are grandfathered.
      const { data: eligible, error: gateErr } = await serviceClient.rpc(
        "can_buy_extra_seats",
        { _circle_id: circleId },
      );
      if (gateErr) throw gateErr;
      if (eligible !== true) {
        return new Response(
          JSON.stringify({ error: "SUBSCRIPTION_REQUIRED" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Record the grant BEFORE mutating so a race between duplicate calls
      // can't double-credit. If insert loses the unique-index race, the
      // other caller already handled it — return success and skip mutation.
      const { error: ledgerErr } = await serviceClient
        .from("google_iap_grants")
        .insert({
          user_id: user.id,
          purchase_token: purchaseToken,
          product_id: productId,
          kind: "extra_members",
          circle_id: circleId,
          source: "google",
        });
      if (ledgerErr) {
        console.log("[validate-google-receipt] extra_members ledger insert lost race — returning success", ledgerErr.message);
        return new Response(
          JSON.stringify({ success: true, duplicate: true, kind: "extra_members" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: updErr } = await serviceClient
        .from("circles")
        .update({ extra_members: (circle.extra_members ?? 0) + EXTRA_MEMBERS_INCREMENT })
        .eq("id", circleId);
      if (updErr) throw updErr;

      await consumePurchase(packageName, productId, purchaseToken);

      return new Response(
        JSON.stringify({ success: true, kind: "extra_members", added: EXTRA_MEMBERS_INCREMENT }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === Subscription ===
    const planConfig = PRODUCT_TO_PLAN[productId];
    if (!planConfig) throw new Error("Unknown product ID");

    const sub = await fetchSubscriptionPurchase(packageName, productId, purchaseToken);
    if (!sub) {
      return new Response(
        JSON.stringify({
          error: "Google is temporarily unable to verify this subscription. Please try again.",
          retry: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // paymentState: 1 = received, 2 = free trial, 3 = pending deferred
    if (sub.paymentState !== undefined && ![1, 2, 3].includes(sub.paymentState)) {
      throw new Error(`Subscription payment not received (paymentState=${sub.paymentState})`);
    }
    const expiresMs = sub.expiryTimeMillis ? Number(sub.expiryTimeMillis) : null;
    if (expiresMs && expiresMs < Date.now()) {
      throw new Error("Subscription has expired");
    }

    // Record grant BEFORE mutating user_plans so a race between duplicate
    // calls cannot double-apply the plan.
    const { error: subLedgerErr } = await serviceClient
      .from("google_iap_grants")
      .insert({
        user_id: user.id,
        purchase_token: purchaseToken,
        product_id: productId,
        kind: "subscription",
        source: "google",
      });
    if (subLedgerErr) {
      console.log("[validate-google-receipt] subscription ledger insert lost race — returning success", subLedgerErr.message);
      return new Response(
        JSON.stringify({ success: true, duplicate: true, plan: planConfig.plan }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updateError } = await serviceClient
      .from("user_plans")
      .update({
        plan: planConfig.plan,
        max_circles: planConfig.max_circles,
        max_members_per_circle: planConfig.max_members_per_circle,
        cancel_at_period_end: false,
        pending_plan: null,
        current_period_end: expiresMs ? new Date(expiresMs).toISOString() : null,
        google_purchase_token: purchaseToken,
        google_subscription_id: productId,
        source: "google",
      })
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    await serviceClient
      .from("user_plans")
      .update({ subscription_started_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("subscription_started_at", null);

    // Acknowledge so Play doesn't auto-refund after 3 days
    if (sub.acknowledgementState === 0) {
      await acknowledgeSubscription(packageName, productId, purchaseToken);
    }

    if (rescue_circle_id) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { error: claimErr } = await userClient.rpc("claim_circle_ownership", {
        _circle_id: rescue_circle_id,
      });
      if (claimErr) {
        return new Response(
          JSON.stringify({ success: true, plan: planConfig.plan, rescue_error: claimErr.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ success: true, plan: planConfig.plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[validate-google-receipt] ERROR:", error?.message ?? error, error?.stack ?? "");
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
