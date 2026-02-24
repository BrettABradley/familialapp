import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

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

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify this session belongs to the authenticated user
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0 || session.customer !== customers.data[0].id) {
      throw new Error("Unauthorized: session does not belong to this user");
    }

    // Get line items
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id, { limit: 10 });

    // Build receipt data
    const purchaseDate = new Date(session.created * 1000);
    const formattedDate = purchaseDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const totalAmount = session.amount_total
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : "$0.00";

    // Generate PDF
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 60;
    let y = 60;

    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Familial", margin, y);
    y += 12;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("support@support.familialmedia.com", margin, y + 14);
    y += 40;

    // "RECEIPT" title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("RECEIPT", margin, y);
    y += 30;

    // Receipt details
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Date", margin, y);
    doc.text("Receipt #", margin + 200, y);
    y += 16;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(formattedDate, margin, y);
    doc.text(session_id.substring(0, 20), margin + 200, y);
    y += 12;

    doc.setTextColor(100, 100, 100);
    doc.text("Email", margin, y + 16);
    y += 32;
    doc.setTextColor(0, 0, 0);
    doc.text(user.email, margin, y);
    y += 35;

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 25;

    // Items header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("DESCRIPTION", margin, y);
    doc.text("QTY", pageWidth - margin - 120, y, { align: "right" });
    doc.text("AMOUNT", pageWidth - margin, y, { align: "right" });
    y += 20;

    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;

    // Line items
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    for (const item of lineItems.data) {
      const priceId = item.price?.id;
      const desc = (priceId && PRICE_DETAILS[priceId]) || item.description || "Purchase";
      const qty = String(item.quantity || 1);
      const amt = item.amount_total ? `$${(item.amount_total / 100).toFixed(2)}` : "$0.00";

      doc.text(desc, margin, y);
      doc.text(qty, pageWidth - margin - 120, y, { align: "right" });
      doc.text(amt, pageWidth - margin, y, { align: "right" });
      y += 22;
    }

    y += 10;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 25;

    // Total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total", margin, y);
    doc.text(totalAmount, pageWidth - margin, y, { align: "right" });
    y += 40;

    // Footer message
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Thank you so much for your business. We hope our products bring you closer",
      margin,
      y
    );
    y += 14;
    doc.text("to your family and close friends.", margin, y);
    y += 24;
    doc.text("All sales are final and non-refundable.", margin, y);

    // Output PDF
    const pdfOutput = doc.output("arraybuffer");

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Familial-Receipt-${formattedDate.replace(/[, ]+/g, "-")}.pdf"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
