import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_NAMES: Record<string, string> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": "Family",
  "price_1T3N5nCiWDzualH5SBHxbHqo": "Extended",
};

const PLAN_MONTHLY: Record<string, number> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": 700,
  "price_1T3N5nCiWDzualH5SBHxbHqo": 1500,
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PREVIEW-UPGRADE] ${step}${detailsStr}`);
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

    const planName = PLAN_NAMES[priceId];
    if (!planName) throw new Error("Invalid price ID");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) throw new Error("No Stripe customer found.");
    const customerId = customers.data[0].id;

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subscriptions.data.length === 0) throw new Error("No active subscription found.");

    const subscription = subscriptions.data[0];
    const subscriptionItemId = subscription.items.data[0].id;
    logStep("Found subscription", { subscriptionId: subscription.id });

    // Create preview invoice to see prorated amount
    const preview = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscription.id,
      subscription_items: [{
        id: subscriptionItemId,
        price: priceId,
      }],
      subscription_proration_behavior: "always_invoice",
    });

    // The amount_due is the prorated charge
    const proratedAmount = preview.amount_due;
    const nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
    const newMonthlyPrice = PLAN_MONTHLY[priceId] ?? 0;

    logStep("Preview generated", { proratedAmount, newMonthlyPrice, nextBillingDate });

    return new Response(
      JSON.stringify({
        prorated_amount: proratedAmount,
        new_monthly_price: newMonthlyPrice,
        next_billing_date: nextBillingDate,
        plan_name: planName,
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
