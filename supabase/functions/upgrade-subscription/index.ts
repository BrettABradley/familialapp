import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPGRADE-SUBSCRIPTION] ${step}${detailsStr}`);
};

const PLAN_CONFIG: Record<string, { priceId: string; plan: string; maxCircles: number; maxMembers: number }> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": { priceId: "price_1T3N5bCiWDzualH5Cf7G7VsM", plan: "family", maxCircles: 2, maxMembers: 20 },
  "price_1T3N5nCiWDzualH5SBHxbHqo": { priceId: "price_1T3N5nCiWDzualH5SBHxbHqo", plan: "extended", maxCircles: 3, maxMembers: 35 },
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

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const newPlanConfig = PLAN_CONFIG[priceId];
    if (!newPlanConfig) throw new Error("Invalid price ID");
    logStep("Target plan", { plan: newPlanConfig.plan, priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find the Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found. Please subscribe first.");
    }

    const subscription = subscriptions.data[0];
    const subscriptionItemId = subscription.items.data[0].id;
    const currentPriceId = subscription.items.data[0].price.id;
    logStep("Found active subscription", { 
      subscriptionId: subscription.id, 
      currentPriceId,
      subscriptionItemId 
    });

    if (currentPriceId === priceId) {
      throw new Error("You are already on this plan");
    }

    // Update the subscription with proration (only pay the difference)
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscriptionItemId,
        price: priceId,
      }],
      proration_behavior: "always_invoice", // Immediately charge the prorated difference
      cancel_at_period_end: false, // Clear any pending cancellation
    });

    const periodEnd = updated.current_period_end 
      ? new Date(updated.current_period_end * 1000).toISOString() 
      : null;

    logStep("Subscription upgraded", { 
      newPlan: newPlanConfig.plan, 
      periodEnd,
      prorationBehavior: "always_invoice"
    });

    // Update user_plans in the database
    const { error: dbError } = await supabase
      .from("user_plans")
      .update({
        plan: newPlanConfig.plan,
        max_circles: newPlanConfig.maxCircles,
        max_members_per_circle: newPlanConfig.maxMembers,
        cancel_at_period_end: false,
        current_period_end: periodEnd,
        pending_plan: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (dbError) {
      console.error("[UPGRADE-SUBSCRIPTION] DB update error:", dbError);
    }

    logStep("Database updated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        plan: newPlanConfig.plan,
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
