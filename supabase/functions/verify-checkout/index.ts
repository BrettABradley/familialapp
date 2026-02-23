import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICES = {
  family: "price_1T3N5bCiWDzualH5Cf7G7VsM",
  extended: "price_1T3N5nCiWDzualH5SBHxbHqo",
  extraMembers: "price_1T3N5zCiWDzualH52rsDSBlu",
};

const PRICE_DETAILS: Record<string, { description: string; amount: string }> = {
  [PRICES.family]: { description: "Family Plan (Monthly)", amount: "$7.00" },
  [PRICES.extended]: { description: "Extended Plan (Monthly)", amount: "$15.00" },
  [PRICES.extraMembers]: { description: "Extra Member Pack (+7 members)", amount: "$5.00" },
};

const log = (step: string, details?: any) => {
  console.log(`[VERIFY-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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
    log("Unknown price ID for receipt", { priceId });
    return;
  }

  const now = new Date();
  const purchaseDate = formatDate(now);
  const subject = `Your Familial Receipt - ${purchaseDate}`;
  const html = buildReceiptHtml(details.description, details.amount, purchaseDate);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    log("RESEND_API_KEY not set, skipping receipt email");
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
      log("Receipt email failed", { status: res.status, result });
    } else {
      log("Receipt email sent", { to: toEmail, messageId: result.id });
    }
  } catch (err) {
    log("Receipt email error", { message: err.message });
  }
}

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
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;
    log("Authenticated", { userId: user.id });

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");
    log("Session ID", { sessionId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    log("Session retrieved", { mode: session.mode, status: session.payment_status, metadata: session.metadata });

    // Verify the user matches
    if (session.metadata?.user_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    let result: any = { type: "unknown" };
    let purchasedPriceId: string | undefined;

    if (session.mode === "subscription") {
      // Determine which plan based on line items
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      purchasedPriceId = priceId;
      log("Subscription price", { priceId });

      let plan = "free";
      let maxCircles = 1;
      let maxMembersPerCircle = 8;

      if (priceId === PRICES.family) {
        plan = "family";
        maxCircles = 2;
        maxMembersPerCircle = 20;
      } else if (priceId === PRICES.extended) {
        plan = "extended";
        maxCircles = 3;
        maxMembersPerCircle = 35;
      }

      log("Upserting plan", { plan, maxCircles, maxMembersPerCircle });

      const { error: upsertError } = await supabaseAdmin
        .from("user_plans")
        .update({
          plan,
          max_circles: maxCircles,
          max_members_per_circle: maxMembersPerCircle,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (upsertError) {
        log("Upsert error", { error: upsertError.message });
        throw new Error("Failed to update plan: " + upsertError.message);
      }

      result = { type: "subscription", plan, maxCircles, maxMembersPerCircle };
    } else if (session.mode === "payment") {
      // Extra members purchase
      const circleId = session.metadata?.circle_id;
      if (!circleId) throw new Error("No circle_id in session metadata");

      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
      purchasedPriceId = lineItems.data[0]?.price?.id;

      // Get current extra_members
      const { data: circleData, error: fetchError } = await supabaseAdmin
        .from("circles")
        .select("extra_members")
        .eq("id", circleId)
        .maybeSingle();

      if (fetchError || !circleData) throw new Error("Circle not found");

      const newExtra = (circleData.extra_members || 0) + 7;
      log("Updating extra members", { circleId, oldExtra: circleData.extra_members, newExtra });

      const { error: updateError } = await supabaseAdmin
        .from("circles")
        .update({ extra_members: newExtra })
        .eq("id", circleId);

      if (updateError) throw new Error("Failed to update extra members: " + updateError.message);

      result = { type: "extra_members", circleId, newExtra };
    }

    // Send receipt email (best-effort)
    if (user.email && purchasedPriceId) {
      sendReceiptEmail(user.email, purchasedPriceId).catch((err) =>
        log("Receipt email background error", { message: err.message })
      );
    }

    log("Success", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
