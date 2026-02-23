import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_DETAILS: Record<string, string> = {
  "price_1T3N5bCiWDzualH5Cf7G7VsM": "Family Plan (Monthly)",
  "price_1T3N5nCiWDzualH5SBHxbHqo": "Extended Plan (Monthly)",
  "price_1T3N5zCiWDzualH52rsDSBlu": "Extra Member Pack (+7 members)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ receipts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;

    // Get all paid invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: "paid",
      limit: 50,
    });

    // Also get completed checkout sessions for initial purchases
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "complete",
      limit: 50,
    });

    const receipts: Array<{
      id: string;
      date: string;
      description: string;
      amount: string;
      type: string;
    }> = [];

    // Process invoices
    for (const invoice of invoices.data) {
      if (!invoice.amount_paid || invoice.amount_paid <= 0) continue;

      let description = "Subscription Payment";
      if (invoice.billing_reason === "subscription_update") {
        description = "Plan Upgrade (prorated)";
      } else if (invoice.billing_reason === "subscription_cycle") {
        // Try to get the price description
        const lineItem = invoice.lines?.data?.[0];
        const priceId = lineItem?.price?.id;
        if (priceId && PRICE_DETAILS[priceId]) {
          description = PRICE_DETAILS[priceId];
        }
      } else if (invoice.billing_reason === "subscription_create") {
        const lineItem = invoice.lines?.data?.[0];
        const priceId = lineItem?.price?.id;
        if (priceId && PRICE_DETAILS[priceId]) {
          description = PRICE_DETAILS[priceId];
        }
      }

      receipts.push({
        id: invoice.id,
        date: new Date(invoice.created * 1000).toISOString(),
        description,
        amount: `$${(invoice.amount_paid / 100).toFixed(2)}`,
        type: invoice.billing_reason || "payment",
      });
    }

    // Process checkout sessions that may not have invoices (one-time purchases)
    for (const session of sessions.data) {
      if (session.payment_status !== "paid") continue;
      if (session.mode === "subscription") continue; // Already covered by invoices

      const amount = session.amount_total;
      if (!amount || amount <= 0) continue;

      // Check if we already have this via an invoice
      if (session.invoice && receipts.some((r) => r.id === session.invoice)) continue;

      receipts.push({
        id: session.id,
        date: new Date(session.created * 1000).toISOString(),
        description: "One-time Purchase",
        amount: `$${(amount / 100).toFixed(2)}`,
        type: "checkout",
      });
    }

    // Sort by date descending
    receipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(JSON.stringify({ receipts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
