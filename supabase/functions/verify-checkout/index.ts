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

const log = (step: string, details?: any) => {
  console.log(`[VERIFY-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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

    if (session.mode === "subscription") {
      // Determine which plan based on line items
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
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
