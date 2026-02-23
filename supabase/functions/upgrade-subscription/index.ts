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

async function sendReceiptEmail(toEmail: string, planName: string, amountCents: number): Promise<void> {
  const now = new Date();
  const purchaseDate = formatDate(now);
  const subject = `Your Familial Receipt - ${purchaseDate}`;
  const amountStr = `$${(amountCents / 100).toFixed(2)}`;
  const description = `Upgrade to ${planName} Plan (prorated)`;
  const html = buildReceiptHtml(description, amountStr, purchaseDate);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    logStep("RESEND_API_KEY not set, skipping receipt email");
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
      console.error("[UPGRADE-SUBSCRIPTION] Receipt email failed:", result);
    } else {
      logStep("Receipt email sent", { to: toEmail });
    }
  } catch (err: any) {
    console.error("[UPGRADE-SUBSCRIPTION] Receipt email error:", err.message);
  }
}

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
      proration_behavior: "always_invoice",
      cancel_at_period_end: false,
    });

    const periodEnd = updated.current_period_end 
      ? new Date(updated.current_period_end * 1000).toISOString() 
      : null;

    logStep("Subscription upgraded", { 
      newPlan: newPlanConfig.plan, 
      periodEnd,
      prorationBehavior: "always_invoice"
    });

    // Retrieve the latest invoice to get the actual charged amount
    let chargedAmountCents = 0;
    try {
      const invoices = await stripe.invoices.list({
        subscription: subscription.id,
        limit: 1,
      });
      if (invoices.data.length > 0) {
        chargedAmountCents = invoices.data[0].amount_paid;
        logStep("Invoice amount", { chargedAmountCents });
      }
    } catch (invoiceErr: any) {
      logStep("Could not retrieve invoice", { error: invoiceErr.message });
    }

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

    // Send receipt email (best-effort, don't block response)
    if (user.email && chargedAmountCents > 0) {
      sendReceiptEmail(user.email, newPlanConfig.plan.charAt(0).toUpperCase() + newPlanConfig.plan.slice(1), chargedAmountCents).catch((err) =>
        console.error("[UPGRADE-SUBSCRIPTION] Receipt background error:", err.message)
      );
    }

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
