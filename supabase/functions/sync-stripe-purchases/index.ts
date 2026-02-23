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
  console.log(`[SYNC-STRIPE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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
    // This function can be called by an admin user or via service role
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user) {
        const { data: planData } = await supabaseAdmin
          .from("user_plans")
          .select("plan")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (planData?.plan !== "admin") {
          throw new Error("Only admins can run sync");
        }
        log("Admin authenticated", { userId: userData.user.id });
      }
    }

    log("Starting sync");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // List all completed checkout sessions
    const sessions: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { limit: 100, status: "complete" };
      if (startingAfter) params.starting_after = startingAfter;
      const batch = await stripe.checkout.sessions.list(params);
      sessions.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    log("Found checkout sessions", { count: sessions.length });

    const results: any[] = [];

    for (const session of sessions) {
      if (session.payment_status !== "paid") continue;
      const userId = session.metadata?.user_id;
      if (!userId) {
        log("Skipping session without user_id", { sessionId: session.id });
        continue;
      }

      try {
        if (session.mode === "subscription") {
          // Determine plan from line items
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const priceId = lineItems.data[0]?.price?.id;

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

          // Check current plan - only upgrade, never downgrade
          const { data: currentPlan } = await supabaseAdmin
            .from("user_plans")
            .select("plan")
            .eq("user_id", userId)
            .maybeSingle();

          const planRank: Record<string, number> = { free: 0, family: 1, extended: 2, admin: 99 };
          const currentRank = planRank[currentPlan?.plan ?? "free"] ?? 0;
          const newRank = planRank[plan] ?? 0;

          if (newRank > currentRank) {
            const { error } = await supabaseAdmin
              .from("user_plans")
              .update({
                plan,
                max_circles: maxCircles,
                max_members_per_circle: maxMembersPerCircle,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);

            if (error) {
              log("Error updating plan", { userId, error: error.message });
            } else {
              log("Updated plan", { userId, plan });
              results.push({ type: "subscription", userId, plan, sessionId: session.id });
            }
          } else {
            log("Skipping - current plan is same or higher", { userId, currentPlan: currentPlan?.plan, newPlan: plan });
          }
        } else if (session.mode === "payment") {
          const circleId = session.metadata?.circle_id;
          if (!circleId) {
            log("Skipping payment without circle_id", { sessionId: session.id });
            continue;
          }

          // Check if this session was already processed by looking at the extra_members count
          // We'll track processed sessions by checking if extra members were already added
          const { data: circleData } = await supabaseAdmin
            .from("circles")
            .select("extra_members")
            .eq("id", circleId)
            .maybeSingle();

          if (!circleData) {
            log("Circle not found", { circleId });
            continue;
          }

          // Count how many extra member payments exist for this circle
          const paymentSessions = sessions.filter(
            (s) => s.mode === "payment" && s.payment_status === "paid" && s.metadata?.circle_id === circleId
          );
          const expectedExtra = paymentSessions.length * 7;

          if (circleData.extra_members < expectedExtra) {
            const { error } = await supabaseAdmin
              .from("circles")
              .update({ extra_members: expectedExtra })
              .eq("id", circleId);

            if (error) {
              log("Error updating extra members", { circleId, error: error.message });
            } else {
              log("Updated extra members", { circleId, from: circleData.extra_members, to: expectedExtra });
              results.push({ type: "extra_members", circleId, extraMembers: expectedExtra, sessionId: session.id });
            }
          } else {
            log("Extra members already up to date", { circleId, current: circleData.extra_members, expected: expectedExtra });
          }
        }
      } catch (sessionError) {
        log("Error processing session", { sessionId: session.id, error: sessionError.message });
      }
    }

    log("Sync complete", { totalProcessed: results.length });

    return new Response(JSON.stringify({ synced: results, totalSessions: sessions.length }), {
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
