import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Use service role to gather all user data
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const [profile, posts, comments, privateMessages, events, fridgePins, familyTree, profileImages] =
      await Promise.all([
        admin.from("profiles").select("*").eq("user_id", userId).single(),
        admin.from("posts").select("*").eq("author_id", userId).order("created_at", { ascending: false }),
        admin.from("comments").select("*").eq("author_id", userId).order("created_at", { ascending: false }),
        admin.from("private_messages").select("*").or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order("created_at", { ascending: false }).limit(1000),
        admin.from("events").select("*").eq("created_by", userId).order("created_at", { ascending: false }),
        admin.from("fridge_pins").select("*").eq("pinned_by", userId).order("created_at", { ascending: false }),
        admin.from("family_tree_members").select("*").eq("created_by", userId),
        admin.from("profile_images").select("*").eq("user_id", userId),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      posts: posts.data || [],
      comments: comments.data || [],
      private_messages: privateMessages.data || [],
      events: events.data || [],
      fridge_pins: fridgePins.data || [],
      family_tree_members: familyTree.data || [],
      profile_images: profileImages.data || [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="familial-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
