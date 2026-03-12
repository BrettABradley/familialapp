import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function is called by a database webhook trigger.
    // It receives the new notification row as the payload.
    const { record } = await req.json();

    if (!record || !record.user_id) {
      return new Response(
        JSON.stringify({ error: "Missing notification record" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { user_id, title, message, link, type } = record;

    // Use service role to read push_tokens (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all Expo push tokens for this user
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("expo_token")
      .eq("user_id", user_id);

    if (tokenError) {
      console.error("Error fetching tokens:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!tokens || tokens.length === 0) {
      // User has no registered push tokens — nothing to send
      return new Response(
        JSON.stringify({ skipped: true, reason: "No push tokens registered" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build Expo push messages
    const messages = tokens.map((t: { expo_token: string }) => ({
      to: t.expo_token,
      sound: "default",
      title: title || "Familial",
      body: message || "",
      data: {
        type: type || "general",
        link: link || null,
      },
    }));

    // Send to Expo Push API (supports batch)
    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const expoResult = await expoResponse.json();

    if (!expoResponse.ok) {
      console.error("Expo push error:", expoResult);
      return new Response(
        JSON.stringify({ error: "Expo push failed", details: expoResult }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Clean up invalid tokens (DeviceNotRegistered)
    if (expoResult.data) {
      const invalidTokens: string[] = [];
      expoResult.data.forEach(
        (result: { status: string; details?: { error?: string } }, index: number) => {
          if (
            result.status === "error" &&
            result.details?.error === "DeviceNotRegistered"
          ) {
            invalidTokens.push(tokens[index].expo_token);
          }
        }
      );

      if (invalidTokens.length > 0) {
        await supabase
          .from("push_tokens")
          .delete()
          .eq("user_id", user_id)
          .in("expo_token", invalidTokens);

        console.log(`Cleaned up ${invalidTokens.length} invalid token(s)`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: messages.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
