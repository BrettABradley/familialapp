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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    // Accept either `device_token` (new) or `expo_token` (legacy alias).
    const device_token: string | undefined = body?.device_token ?? body?.expo_token;
    const rawPlatform: string = (body?.platform ?? "ios").toString().toLowerCase();
    const platform = rawPlatform === "android" ? "android" : "ios";

    if (!device_token || typeof device_token !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid device_token" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Reclaim this device token: remove any rows where it's still attached
    // to a different user (e.g. previous account on a shared device, or a
    // user who signed out without the unregister call reaching the server).
    // Guarantees one device token → exactly one user_id per platform.
    const { error: reclaimError } = await admin
      .from("push_tokens")
      .delete()
      .eq("device_token", device_token)
      .neq("user_id", user.id);

    if (reclaimError) {
      console.error("Reclaim error (non-fatal):", reclaimError);
    }

    const { error: upsertError } = await admin
      .from("push_tokens")
      .upsert(
        { user_id: user.id, device_token, platform },
        { onConflict: "user_id,device_token,platform" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to register token" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
