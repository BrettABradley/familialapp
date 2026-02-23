import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_TO_PLAN_NAME: Record<string, string> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": "Family",
  "price_1T3N5nCiWDzualH5SBHxbHqo": "Extended",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildCancelEmailHtml(planName: string, accessEndDate: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
<div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0;">Familial</h1>
  <h2 style="color: #555; font-size: 18px; font-weight: normal; margin: 0 0 24px 0;">Cancellation Confirmation</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #333; margin-bottom: 24px;">
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px 0; font-weight: 600;">Canceled Plan</td>
      <td style="padding: 12px 0; text-align: right;">${planName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px 0; font-weight: 600;">Access Until</td>
      <td style="padding: 12px 0; text-align: right;">${accessEndDate}</td>
    </tr>
    <tr>
      <td style="padding: 12px 0; font-weight: 600;">Future Billing</td>
      <td style="padding: 12px 0; text-align: right; color: #16a34a; font-weight: 600;">No further charges</td>
    </tr>
  </table>
  <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Your <strong>${planName}</strong> subscription has been canceled. You'll continue to have full access to all your plan features until <strong>${accessEndDate}</strong>. After that, your account will switch to the Free plan.</p>
  <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">If you change your mind, you can reactivate your plan at any time from the pricing page before your access ends.</p>
  <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Thank you for being part of the Familial community. We hope to see you again.</p>
  <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; padding-top: 16px; border-top: 1px solid #eee;"><strong>Refund Policy:</strong> All purchases are non-refundable.</p>
  <p style="color: #888; font-size: 13px; margin: 0;">Questions? Contact us at <a href="mailto:support@support.familialmedia.com" style="color: #888;">support@support.familialmedia.com</a></p>
</div></div></body></html>`;
}

async function sendCancelEmail(toEmail: string, planName: string, accessEndDate: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    logStep("RESEND_API_KEY not set, skipping email");
    return;
  }

  const subject = `Your Familial Cancellation Confirmation - ${formatDate(new Date())}`;
  const html = buildCancelEmailHtml(planName, accessEndDate);

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
      console.error("[CANCEL-SUBSCRIPTION] Email failed:", result);
    } else {
      logStep("Cancellation email sent", { to: toEmail });
    }
  } catch (err: any) {
    console.error("[CANCEL-SUBSCRIPTION] Email error:", err.message);
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find the Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
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
      throw new Error("No active subscription found");
    }

    const subscription = subscriptions.data[0];
    logStep("Found active subscription", { subscriptionId: subscription.id });

    // Determine the plan name from the current price
    const currentPriceId = subscription.items.data[0].price.id;
    const planName = PRICE_TO_PLAN_NAME[currentPriceId] || "Premium";

    // Set cancel_at_period_end = true (keeps access until period ends)
    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    const periodEndTimestamp = updated.current_period_end;
    const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000).toISOString() : null;
    logStep("Subscription set to cancel at period end", { periodEnd });

    const accessEndFormatted = periodEnd
      ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "the end of your billing period";

    // Update user_plans to reflect pending cancellation
    const { error: dbError } = await supabase
      .from("user_plans")
      .update({
        cancel_at_period_end: true,
        pending_plan: null,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (dbError) {
      console.error("[CANCEL-SUBSCRIPTION] DB update error:", dbError);
    }

    // Send cancellation email (best-effort)
    if (user.email) {
      sendCancelEmail(user.email, planName, accessEndFormatted).catch((err) =>
        console.error("[CANCEL-SUBSCRIPTION] Email background error:", err.message)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancel_at_period_end: true,
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
