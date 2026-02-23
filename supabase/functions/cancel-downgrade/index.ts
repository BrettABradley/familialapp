import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTENDED_PRICE_ID = "price_1T3N5nCiWDzualH5SBHxbHqo";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-DOWNGRADE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) throw new Error("No Stripe customer found");
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subscriptions.data.length === 0) throw new Error("No active subscription found");

    const subscription = subscriptions.data[0];
    const subscriptionItemId = subscription.items.data[0].id;
    logStep("Found subscription", { subscriptionId: subscription.id });

    // Switch price back to Extended with no proration (no extra charge this period)
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: subscriptionItemId, price: EXTENDED_PRICE_ID }],
      proration_behavior: "none",
    });

    const rawEnd = updated.current_period_end;
    const periodEnd = rawEnd
      ? new Date(typeof rawEnd === "number" ? rawEnd * 1000 : rawEnd).toISOString()
      : new Date().toISOString();
    logStep("Subscription restored to Extended", { periodEnd });

    // Update user_plans: clear pending_plan, restore extended limits
    const { error: dbError } = await supabase
      .from("user_plans")
      .update({
        pending_plan: null,
        plan: "extended",
        max_circles: 3,
        max_members_per_circle: 35,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (dbError) {
      console.error("[CANCEL-DOWNGRADE] DB update error:", dbError);
    }

    // Delete open rescue offers created during the downgrade
    const { error: rescueError } = await supabase
      .from("circle_rescue_offers")
      .delete()
      .eq("current_owner", user.id)
      .eq("status", "open");

    if (rescueError) {
      console.error("[CANCEL-DOWNGRADE] Rescue offer cleanup error:", rescueError);
    }

    logStep("Cancel downgrade complete");

    return new Response(
      JSON.stringify({
        success: true,
        plan: "extended",
        current_period_end: periodEnd,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
