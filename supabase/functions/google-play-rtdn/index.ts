// google-play-rtdn
// Webhook receiving Google Play Real-time Developer Notifications (RTDN)
// via Cloud Pub/Sub push. Mirrors the Apple App Store Server Notifications
// flow and the Stripe webhook flow: writes a row to `google_play_events`
// for audit, then mutates user_plans according to the notification type.
//
// Pub/Sub push delivers:
//   { "message": { "data": "<base64 RTDN JSON>", ... }, "subscription": "..." }
//
// RTDN JSON shape (subscriptionNotification example):
//   {
//     "version": "1.0",
//     "packageName": "space.manus.familial.mobile.t...",
//     "eventTimeMillis": "...",
//     "subscriptionNotification": {
//       "version": "1.0",
//       "notificationType": 4,
//       "purchaseToken": "...",
//       "subscriptionId": "family_monthly"
//     }
//   }
//
// Notification types we care about:
//   1  SUBSCRIPTION_RECOVERED
//   2  SUBSCRIPTION_RENEWED
//   3  SUBSCRIPTION_CANCELED  (user canceled; access until expiry)
//   4  SUBSCRIPTION_PURCHASED
//   5  SUBSCRIPTION_ON_HOLD
//   6  SUBSCRIPTION_IN_GRACE_PERIOD
//   7  SUBSCRIPTION_RESTARTED
//   12 SUBSCRIPTION_REVOKED   (refund or chargeback — strip plan)
//   13 SUBSCRIPTION_EXPIRED
//
// This function deploys with verify_jwt = false (see config.toml below).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PRODUCT_TO_PLAN: Record<
  string,
  { plan: string; max_circles: number; max_members_per_circle: number }
> = {
  family_monthly: { plan: "family", max_circles: 2, max_members_per_circle: 20 },
  extended_monthly: { plan: "extended", max_circles: 3, max_members_per_circle: 35 },
};

const REVOKE_TYPES = new Set([12, 13]); // revoked / expired
const ACTIVE_TYPES = new Set([1, 2, 4, 7]); // recovered, renewed, purchased, restarted

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let payload: any = null;
  try {
    const envelope = await req.json();
    const dataB64 = envelope?.message?.data;
    if (!dataB64) {
      // Allow direct posting of the raw RTDN body for manual replay
      payload = envelope;
    } else {
      const decoded = atob(dataB64);
      payload = JSON.parse(decoded);
    }
  } catch (err) {
    console.error("[google-play-rtdn] bad envelope", err);
    return new Response("bad request", { status: 400, headers: cors });
  }

  const subNotif = payload?.subscriptionNotification;
  const oneTimeNotif = payload?.oneTimeProductNotification;
  const testNotif = payload?.testNotification;

  const purchaseToken: string | null =
    subNotif?.purchaseToken ?? oneTimeNotif?.purchaseToken ?? null;
  const subscriptionId: string | null =
    subNotif?.subscriptionId ?? oneTimeNotif?.sku ?? null;
  const notificationType: number | null =
    subNotif?.notificationType ?? oneTimeNotif?.notificationType ?? null;

  // Always log
  const { data: existing } = await service
    .from("user_plans")
    .select("user_id")
    .eq("google_purchase_token", purchaseToken ?? "")
    .maybeSingle();

  const userId = existing?.user_id ?? null;

  const { data: eventRow } = await service
    .from("google_play_events")
    .insert({
      notification_type: notificationType,
      subscription_id: subscriptionId,
      purchase_token: purchaseToken,
      package_name: payload?.packageName ?? null,
      user_id: userId,
      payload,
    })
    .select("id")
    .single();

  // Test pings just acknowledge
  if (testNotif) {
    await service
      .from("google_play_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", eventRow?.id ?? "");
    return new Response("ok", { headers: cors });
  }

  try {
    if (subNotif && purchaseToken && subscriptionId && notificationType !== null) {
      if (!userId) {
        // Notification arrived before client-side validate finished — that's
        // fine, the event log is enough for reconciliation.
        console.log("[google-play-rtdn] no user_plans match for token (pending)");
      } else if (REVOKE_TYPES.has(notificationType)) {
        await service
          .from("user_plans")
          .update({
            plan: "free",
            max_circles: 1,
            max_members_per_circle: 8,
            cancel_at_period_end: false,
            pending_plan: null,
          })
          .eq("user_id", userId);
      } else if (notificationType === 3) {
        // canceled but access continues until period end
        await service
          .from("user_plans")
          .update({ cancel_at_period_end: true })
          .eq("user_id", userId);
      } else if (notificationType === 5) {
        // on hold — treat as revoked access until recovery
        await service
          .from("user_plans")
          .update({ plan: "free", max_circles: 1, max_members_per_circle: 8 })
          .eq("user_id", userId);
      } else if (ACTIVE_TYPES.has(notificationType)) {
        const planConfig = PRODUCT_TO_PLAN[subscriptionId];
        if (planConfig) {
          await service
            .from("user_plans")
            .update({
              plan: planConfig.plan,
              max_circles: planConfig.max_circles,
              max_members_per_circle: planConfig.max_members_per_circle,
              cancel_at_period_end: false,
              pending_plan: null,
              source: "google",
            })
            .eq("user_id", userId);
        }
      }
    }

    await service
      .from("google_play_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", eventRow?.id ?? "");
  } catch (err: any) {
    console.error("[google-play-rtdn] processing error", err);
    await service
      .from("google_play_events")
      .update({ error: String(err?.message ?? err) })
      .eq("id", eventRow?.id ?? "");
  }

  // Always 200 — Pub/Sub will retry non-2xx forever.
  return new Response("ok", { headers: cors });
});
