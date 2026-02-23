import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Stripe product/price mappings
const FAMILY_PRODUCT_ID = "prod_U1PvvkbplSC8Pm";
const EXTENDED_PRODUCT_ID = "prod_U1Pvf5979SAZsB";
const EXTRA_MEMBERS_PRODUCT_ID = "prod_U1PvysvzZ3r0O4";

const PRICE_DETAILS: Record<string, { description: string; amount: string }> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": { description: "Family Plan (Monthly)", amount: "$7.00" },
  "price_1T3N5nCiWDzualH5SBHxbHqo": { description: "Extended Plan (Monthly)", amount: "$15.00" },
  "price_1T3N5zCiWDzualH52rsDSBlu": { description: "Extra Member Pack (+7 members)", amount: "$5.00" },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildReceiptHtml(itemDescription: string, itemAmount: string, purchaseDate: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
<div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0;">Familial</h1>
  <h2 style="color: #555; font-size: 18px; font-weight: normal; margin: 0 0 24px 0;">Purchase Receipt</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #333; margin-bottom: 24px;">
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px 0; font-weight: 600;">Item</td>
      <td style="padding: 12px 0; text-align: right;">${itemDescription}</td>
    </tr>
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px 0; font-weight: 600;">Amount</td>
      <td style="padding: 12px 0; text-align: right;">${itemAmount}</td>
    </tr>
    <tr>
      <td style="padding: 12px 0; font-weight: 600;">Date</td>
      <td style="padding: 12px 0; text-align: right;">${purchaseDate}</td>
    </tr>
  </table>
  <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Thank you so much for your business. We hope our products bring you closer to your family and close friends.</p>
  <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; padding-top: 16px; border-top: 1px solid #eee;"><strong>Refund Policy:</strong> All purchases are non-refundable.</p>
  <p style="color: #888; font-size: 13px; margin: 0;">Questions? Contact us at <a href="mailto:support@support.familialmedia.com" style="color: #888;">support@support.familialmedia.com</a></p>
</div></div></body></html>`;
}

async function sendReceiptEmail(toEmail: string, priceId: string): Promise<void> {
  const details = PRICE_DETAILS[priceId];
  if (!details) {
    console.log(`[STRIPE-WEBHOOK] Unknown price ID for receipt: ${priceId}`);
    return;
  }

  const now = new Date();
  const purchaseDate = formatDate(now);
  const subject = `Your Familial Receipt - ${purchaseDate}`;
  const html = buildReceiptHtml(details.description, details.amount, purchaseDate);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.log("[STRIPE-WEBHOOK] RESEND_API_KEY not set, skipping receipt email");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Familial <support@support.familialmedia.com>",
        to: [toEmail],
        subject,
        html,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[STRIPE-WEBHOOK] Receipt email failed:", result);
    } else {
      console.log(`[STRIPE-WEBHOOK] Receipt email sent to ${toEmail}`);
    }
  } catch (err) {
    console.error("[STRIPE-WEBHOOK] Receipt email error:", err.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    console.log(`[STRIPE-WEBHOOK] Event type: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const customerEmail = session.customer_email || session.customer_details?.email;

      if (!userId) {
        console.log("[STRIPE-WEBHOOK] No user_id in metadata, skipping");
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      let receiptPriceId: string | undefined;

      if (session.mode === "subscription") {
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = subscription.items.data[0]?.price?.product as string;
        receiptPriceId = subscription.items.data[0]?.price?.id;

        let plan = "free";
        let maxCircles = 1;
        let maxMembers = 8;

        if (productId === FAMILY_PRODUCT_ID) {
          plan = "family";
          maxCircles = 2;
          maxMembers = 20;
        } else if (productId === EXTENDED_PRODUCT_ID) {
          plan = "extended";
          maxCircles = 3;
          maxMembers = 35;
        }

        console.log(`[STRIPE-WEBHOOK] Updating user ${userId} to plan: ${plan}`);

        const { error } = await supabase
          .from("user_plans")
          .upsert({
            user_id: userId,
            plan,
            max_circles: maxCircles,
            max_members_per_circle: maxMembers,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (error) console.error("[STRIPE-WEBHOOK] Error updating plan:", error);

      } else if (session.mode === "payment") {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const item = lineItems.data[0];
        const productId = item?.price?.product as string;
        receiptPriceId = item?.price?.id;

        if (productId === EXTRA_MEMBERS_PRODUCT_ID) {
          const circleId = session.metadata?.circle_id;

          if (circleId) {
            console.log(`[STRIPE-WEBHOOK] Adding 7 extra members to circle ${circleId}`);

            const { data: circleData } = await supabase
              .from("circles")
              .select("extra_members")
              .eq("id", circleId)
              .maybeSingle();

            const currentExtra = circleData?.extra_members ?? 0;

            const { error } = await supabase
              .from("circles")
              .update({ extra_members: currentExtra + 7 })
              .eq("id", circleId);

            if (error) console.error("[STRIPE-WEBHOOK] Error adding circle extra members:", error);
          } else {
            console.log(`[STRIPE-WEBHOOK] Adding 7 global extra members for user ${userId}`);

            const { data: currentPlan } = await supabase
              .from("user_plans")
              .select("extra_members")
              .eq("user_id", userId)
              .maybeSingle();

            const currentExtra = currentPlan?.extra_members ?? 0;

            const { error } = await supabase
              .from("user_plans")
              .upsert({
                user_id: userId,
                extra_members: currentExtra + 7,
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });

            if (error) console.error("[STRIPE-WEBHOOK] Error adding extra members:", error);
          }
        }
      }

      // Send receipt email (best-effort, backup to verify-checkout)
      if (customerEmail && receiptPriceId) {
        sendReceiptEmail(customerEmail, receiptPriceId).catch((err) =>
          console.error("[STRIPE-WEBHOOK] Receipt background error:", err.message)
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
