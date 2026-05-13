import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TO_PLAN: Record<string, { plan: string; max_circles: number; max_members_per_circle: number }> = {
  "com.familialmedia.familial.family.monthly": { plan: "family", max_circles: 2, max_members_per_circle: 20 },
  "com.familialmedia.familial.extended.monthly": { plan: "extended", max_circles: 3, max_members_per_circle: 35 },
};

const EXTRA_MEMBERS_PRODUCT = "com.familialmedia.familial.extramembers";
const EXTRA_MEMBERS_INCREMENT = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const { kind, transactionId, productId, restore, circleId, rescue_circle_id } = body;

    if (restore) {
      return new Response(JSON.stringify({ success: true, restored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transactionId || !productId) {
      throw new Error("transactionId and productId are required");
    }

    // TODO: Validate transaction with Apple's App Store Server API v2
    // (App Store Server API key required). For now we trust the client-supplied
    // transactionId — the StoreKit purchase already happened on-device.

    // === Extra Members consumable ===
    if (kind === "extra_members" || productId === EXTRA_MEMBERS_PRODUCT) {
      if (!circleId) throw new Error("circleId is required for extra_members");

      // Verify caller owns the circle
      const { data: circle, error: circleErr } = await serviceClient
        .from("circles")
        .select("id, owner_id, extra_members")
        .eq("id", circleId)
        .single();
      if (circleErr || !circle) throw new Error("Circle not found");
      if (circle.owner_id !== user.id) throw new Error("Only the circle owner can add seats");

      const { error: updErr } = await serviceClient
        .from("circles")
        .update({ extra_members: (circle.extra_members ?? 0) + EXTRA_MEMBERS_INCREMENT })
        .eq("id", circleId);
      if (updErr) throw updErr;

      return new Response(JSON.stringify({ success: true, kind: "extra_members", added: EXTRA_MEMBERS_INCREMENT }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Subscription ===
    const planConfig = PRODUCT_TO_PLAN[productId];
    if (!planConfig) {
      throw new Error("Unknown product ID");
    }

    const { error: updateError } = await serviceClient
      .from("user_plans")
      .update({
        plan: planConfig.plan,
        max_circles: planConfig.max_circles,
        max_members_per_circle: planConfig.max_members_per_circle,
        cancel_at_period_end: false,
        pending_plan: null,
        apple_original_transaction_id: transactionId,
        source: "apple",
      })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    // Optional: complete a circle rescue claim after a successful upgrade
    if (rescue_circle_id) {
      // Use a user-scoped client so claim_circle_ownership runs as the caller
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { error: claimErr } = await userClient.rpc("claim_circle_ownership", {
        _circle_id: rescue_circle_id,
      });
      if (claimErr) {
        // Surface but don't roll back the plan change
        return new Response(
          JSON.stringify({ success: true, plan: planConfig.plan, rescue_error: claimErr.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ success: true, plan: planConfig.plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
