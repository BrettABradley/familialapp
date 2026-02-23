import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find all open rescue offers past their deadline
    const { data: expired, error } = await supabase
      .from("circle_rescue_offers")
      .select("id, circle_id, current_owner")
      .eq("status", "open")
      .lt("deadline", new Date().toISOString());

    if (error) {
      console.error("[CLEANUP-RESCUE-OFFERS] Query error:", error);
      throw error;
    }

    if (!expired || expired.length === 0) {
      console.log("[CLEANUP-RESCUE-OFFERS] No expired offers found");
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[CLEANUP-RESCUE-OFFERS] Found ${expired.length} expired offers`);

    // Mark them as expired
    const expiredIds = expired.map((o) => o.id);
    await supabase
      .from("circle_rescue_offers")
      .update({ status: "expired" })
      .in("id", expiredIds);

    // Notify the owners that the rescue period ended with no taker
    for (const offer of expired) {
      await supabase.from("notifications").insert({
        user_id: offer.current_owner,
        type: "circle_rescue_expired",
        title: "Rescue period ended",
        message: "No one claimed ownership. The circle is now read-only.",
        related_circle_id: offer.circle_id,
        link: `/circles`,
      });
    }

    return new Response(
      JSON.stringify({ expired: expired.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CLEANUP-RESCUE-OFFERS] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
