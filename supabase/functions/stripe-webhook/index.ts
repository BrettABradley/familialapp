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
      if (!userId) {
        console.log("[STRIPE-WEBHOOK] No user_id in metadata, skipping");
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      if (session.mode === "subscription") {
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = subscription.items.data[0]?.price?.product as string;

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

        if (productId === EXTRA_MEMBERS_PRODUCT_ID) {
          const circleId = session.metadata?.circle_id;

          if (circleId) {
            // Per-circle extra members
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
            // Fallback: global extra members (backward compat)
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
