import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { text, imageUrls } = await req.json();

    if (!text && (!imageUrls || imageUrls.length === 0)) {
      return new Response(
        JSON.stringify({ allowed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages for the AI
    const userContent: any[] = [];

    if (text) {
      userContent.push({
        type: "text",
        text: `Evaluate this text for safety:\n\n${text}`,
      });
    }

    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        userContent.push({
          type: "image_url",
          image_url: { url },
        });
      }
      userContent.push({
        type: "text",
        text: "Evaluate the above image(s) for safety.",
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a stateless content safety classifier for a family-oriented social platform. You do NOT store, log, or retain any content. You simply evaluate and return a verdict.

Your primary concern is detecting:
1. Pornography, nudity, or sexually explicit content (HIGHEST PRIORITY)
2. Graphic violence or gore
3. Substance abuse imagery (drugs, drug paraphernalia)

You must respond with ONLY a JSON object in this exact format:
{"allowed": true} or {"allowed": false, "reason": "Brief generic reason"}

Rules:
- Be strict about nudity and sexual content — err on the side of caution
- Artistic nudity in paintings/sculptures is acceptable
- Normal family photos, food, pets, landscapes etc. are always allowed
- If text contains explicit sexual descriptions, deny it
- Keep denial reasons generic (e.g. "sexually explicit content", "graphic violence") — do not explain specifics
- Do NOT provide guidance on how to bypass moderation
- Respond with ONLY the JSON object, nothing else`,
            },
            {
              role: "user",
              content: userContent,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      // On AI error, allow content through (fail-open) to not block users
      return new Response(
        JSON.stringify({ allowed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the AI's JSON response
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const verdict = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            allowed: verdict.allowed !== false,
            reason: verdict.reason || undefined,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch {
      // If we can't parse the AI response, fail-open
    }

    return new Response(
      JSON.stringify({ allowed: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("moderate-content error:", e);
    // Fail-open: don't block users if moderation itself fails
    return new Response(
      JSON.stringify({ allowed: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
