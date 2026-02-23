import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const processed: string[] = [];
    const skipped: string[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { status: "complete", limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;

      const sessions = await stripe.checkout.sessions.list(params);

      for (const session of sessions.data) {
        if (session.payment_status !== "paid") {
          skipped.push(session.id);
          continue;
        }

        const email = session.customer_email || session.customer_details?.email;
        if (!email) {
          skipped.push(session.id);
          continue;
        }

        // Get line items to find price ID
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data[0]?.price?.id;
        if (!priceId || !PRICE_DETAILS[priceId]) {
          skipped.push(session.id);
          continue;
        }

        const details = PRICE_DETAILS[priceId];
        const purchaseDate = formatDate(new Date(session.created * 1000));
        const subject = `Your Familial Receipt - ${purchaseDate}`;
        const html = buildReceiptHtml(details.description, details.amount, purchaseDate);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Familial <support@support.familialmedia.com>",
            to: [email],
            subject,
            html,
          }),
        });

        const result = await res.json();
        if (res.ok) {
          console.log(`[SEND-PAST-RECEIPTS] Sent to ${email} for session ${session.id}`);
          processed.push(session.id);
        } else {
          console.error(`[SEND-PAST-RECEIPTS] Failed for ${session.id}:`, result);
          skipped.push(session.id);
        }

        await delay(100);
      }

      hasMore = sessions.has_more;
      if (sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    const summary = {
      emailsSent: processed.length,
      skipped: skipped.length,
      processedSessionIds: processed,
      skippedSessionIds: skipped,
    };

    console.log("[SEND-PAST-RECEIPTS] Complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[SEND-PAST-RECEIPTS] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
