import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const message = (body.message ?? "").toString().trim().slice(0, 2000);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Valid email required" }, 400);
    }
    if (message.length < 20) {
      return json({ error: "Please provide at least 20 characters explaining your appeal" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Rate limit: 1 appeal per email per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("user_appeals")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if ((count ?? 0) >= 1) {
      return json({ error: "An appeal was already submitted in the last 24 hours" }, 429);
    }

    // Look up user id if available
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (match) userId = match.id;

    const { data: inserted, error } = await admin
      .from("user_appeals")
      .insert({ email, message, user_id: userId })
      .select("id")
      .single();

    if (error) return json({ error: error.message }, 500);

    // Notify Brett
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (LOVABLE_API_KEY && RESEND_API_KEY) {
        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "Familial <support@familialmedia.com>",
            to: ["brettbradley007@gmail.com"],
            subject: `New appeal from ${email}`,
            html: `<p><strong>${email}</strong> has submitted an appeal:</p>
                   <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${message.replace(/</g, "&lt;")}</blockquote>
                   <p>Review in the Moderation Console &rarr; Appeals tab.</p>`,
          }),
        });
      }
    } catch (e) {
      console.error("appeal email failed", e);
    }

    return json({ ok: true, id: inserted.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
