import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const FOUNDER_EMAIL = "brettbradley007@gmail.com";

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = userData.user.email;
    if (userEmail !== FOUNDER_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "reports";

    if (tab === "reports") {
      const status = url.searchParams.get("status") || "pending";
      const { data, error } = await supabaseAdmin
        .from("content_reports")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ data, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tab === "banned") {
      const { data, error } = await supabaseAdmin
        .from("banned_emails")
        .select("*")
        .order("banned_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ data, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tab === "audit") {
      const { data, error } = await supabaseAdmin
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ data, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tab === "metrics") {
      // Total users
      const { count: totalUsers } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // New signups last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: newSignups } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo);

      // Total posts
      const { count: totalPosts } = await supabaseAdmin
        .from("posts")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);

      // Posts today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: postsToday } = await supabaseAdmin
        .from("posts")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", todayStart.toISOString());

      // Posts this week
      const { count: postsThisWeek } = await supabaseAdmin
        .from("posts")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", weekAgo);

      // Active users last 7 days (users who posted)
      const { data: activePosters } = await supabaseAdmin
        .from("posts")
        .select("author_id")
        .is("deleted_at", null)
        .gte("created_at", weekAgo);
      const activeUserIds = new Set(activePosters?.map((p: any) => p.author_id) || []);

      // Pending reports
      const { count: pendingReports } = await supabaseAdmin
        .from("content_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Banned users
      const { count: bannedCount } = await supabaseAdmin
        .from("banned_emails")
        .select("*", { count: "exact", head: true });

      return new Response(JSON.stringify({
        data: {
          totalUsers: totalUsers || 0,
          newSignups: newSignups || 0,
          totalPosts: totalPosts || 0,
          postsToday: postsToday || 0,
          postsThisWeek: postsThisWeek || 0,
          activeUsersWeek: activeUserIds.size,
          pendingReports: pendingReports || 0,
          bannedCount: bannedCount || 0,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tab === "deleted") {
      const { data, error } = await supabaseAdmin
        .from("posts")
        .select("id, content, author_id, circle_id, deleted_at, created_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ data, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid tab" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
