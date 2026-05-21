// Shared helper: validate caller is a platform admin
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }
  const supabaseAdmin = getAdminClient();
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await supabaseUser.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userError || !userData?.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }
  const { data: adminRow } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!adminRow) {
    return { error: jsonResponse({ error: "Forbidden" }, 403) };
  }
  return { supabaseAdmin, user: userData.user };
}

export async function logAdminAction(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  adminEmail: string,
  actionType: string,
  payload: { target_user_id?: string | null; details?: any },
) {
  await supabaseAdmin.from("admin_actions").insert({
    admin_email: adminEmail,
    action_type: actionType,
    target_user_id: payload.target_user_id ?? null,
    details: payload.details ?? null,
  });
}
