import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICES: Record<string, { plan: string; maxCircles: number; maxMembers: number }> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": { plan: "family", maxCircles: 2, maxMembers: 20 },
  "price_1T3N5nCiWDzualH5SBHxbHqo": { plan: "extended", maxCircles: 3, maxMembers: 35 },
};

const PLAN_RANK: Record<string, number> = { free: 0, family: 1, extended: 2 };

const log = (step: string, details?: any) => {
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;
    log("Authenticated", { userId: user.id, email: user.email });

    // Founder plan is manually assigned — never overwrite it from Stripe
    const { data: currentPlanCheck } = await supabaseAdmin
      .from("user_plans")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentPlanCheck?.plan === "founder") {
      log("Founder plan detected — skipping Stripe sync", { userId: user.id });
      return new Response(JSON.stringify({ synced: true, plan: "founder" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Look up Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) {
      log("No Stripe customer found — ensuring free plan");
      // No Stripe customer at all — make sure DB reflects free
      await syncToFree(supabaseAdmin, user.id);
      return new Response(JSON.stringify({ synced: true, plan: "free", reason: "no_customer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    log("Found Stripe customer", { customerId });

    // Check active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      log("No active subscriptions — downgrading to free and transfer-blocking overflow");

      // Get current DB plan to check if we need to downgrade
      const { data: currentPlan } = await supabaseAdmin
        .from("user_plans")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();

      await supabaseAdmin.from("user_plans").update({
        plan: "free",
        max_circles: 1,
        max_members_per_circle: 8,
        cancel_at_period_end: false,
        current_period_end: null,
        pending_plan: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      // Transfer-block overflow circles (keep only the oldest 1)
      await transferBlockOverflow(supabaseAdmin, user.id, 1);

      const wasDowngraded = currentPlan?.plan && currentPlan.plan !== "free";
      return new Response(JSON.stringify({
        synced: true,
        plan: "free",
        reason: wasDowngraded ? "subscription_expired" : "no_active_subscription",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the highest-tier active subscription
    let bestPlan = "free";
    let bestMaxCircles = 1;
    let bestMaxMembers = 8;

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const priceId = item.price.id;
        const mapped = PRICES[priceId];
        if (mapped && (PLAN_RANK[mapped.plan] ?? 0) > (PLAN_RANK[bestPlan] ?? 0)) {
          bestPlan = mapped.plan;
          bestMaxCircles = mapped.maxCircles;
          bestMaxMembers = mapped.maxMembers;
        }
      }
    }

    // Find the subscription object that corresponds to our best plan
    const bestSub = subscriptions.data.find(sub =>
      sub.items.data.some(item => PRICES[item.price.id]?.plan === bestPlan)
    );

    const cancelAtPeriodEnd = bestSub?.cancel_at_period_end ?? false;
    const currentPeriodEnd = bestSub?.current_period_end
      ? new Date(bestSub.current_period_end * 1000).toISOString()
      : null;

    log("Best Stripe plan", { bestPlan, bestMaxCircles, bestMaxMembers, cancelAtPeriodEnd, currentPeriodEnd });

    // Always update DB to match Stripe truth
    const { error: updateError } = await supabaseAdmin
      .from("user_plans")
      .update({
        plan: bestPlan,
        max_circles: bestMaxCircles,
        max_members_per_circle: bestMaxMembers,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: currentPeriodEnd,
        pending_plan: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      log("Update error", { error: updateError.message });
      throw new Error("Failed to update plan");
    }

    log("DB synced to Stripe", { plan: bestPlan });
    return new Response(JSON.stringify({ synced: true, plan: bestPlan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function syncToFree(supabaseAdmin: any, userId: string) {
  await supabaseAdmin.from("user_plans").update({
    plan: "free",
    max_circles: 1,
    max_members_per_circle: 8,
    cancel_at_period_end: false,
    current_period_end: null,
    pending_plan: null,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
}

async function transferBlockOverflow(supabaseAdmin: any, userId: string, maxCircles: number) {
  const { data: ownedCircles } = await supabaseAdmin
    .from("circles")
    .select("id")
    .eq("owner_id", userId)
    .eq("transfer_block", false)
    .order("created_at", { ascending: true });

  if (ownedCircles && ownedCircles.length > maxCircles) {
    const overflowIds = ownedCircles.slice(maxCircles).map((c: any) => c.id);
    log("Transfer-blocking overflow circles", { overflowIds });
    await supabaseAdmin.from("circles")
      .update({ transfer_block: true })
      .in("id", overflowIds);
  }
}
