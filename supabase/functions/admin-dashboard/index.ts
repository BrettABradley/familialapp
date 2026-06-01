import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { signPostMediaUrls } from "../_shared/post-media-url.ts";

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

    const { data: adminRow } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "reports";

    if (tab === "reports") {
      const status = url.searchParams.get("status") || "pending";
      const { data: reports, error } = await supabaseAdmin
        .from("content_reports")
        .select("*")
        .eq("status", status)
        .order("sla_due_at", { ascending: true })
        .limit(100);

      // Enrich with reporter / target info + content snippet
      const enriched = await Promise.all((reports ?? []).map(async (r: any) => {
        const [reporterP, reporterPriv, targetP, targetPriv, post, comment, strikes] = await Promise.all([
          supabaseAdmin.from("profiles").select("display_name")
            .eq("user_id", r.reporter_id).maybeSingle(),
          supabaseAdmin.from("user_private").select("spam_reporter")
            .eq("user_id", r.reporter_id).maybeSingle(),
          r.reported_user_id
            ? supabaseAdmin.from("profiles").select("display_name")
                .eq("user_id", r.reported_user_id).maybeSingle()
            : Promise.resolve({ data: null }),
          r.reported_user_id
            ? supabaseAdmin.from("user_private").select("account_status")
                .eq("user_id", r.reported_user_id).maybeSingle()
            : Promise.resolve({ data: null }),
          r.post_id
            ? supabaseAdmin.from("posts").select("content,media_urls,is_hidden,deleted_at")
                .eq("id", r.post_id).maybeSingle()
            : Promise.resolve({ data: null }),
          r.comment_id
            ? supabaseAdmin.from("comments").select("content,is_hidden,deleted_at")
                .eq("id", r.comment_id).maybeSingle()
            : Promise.resolve({ data: null }),
          r.reported_user_id
            ? supabaseAdmin.from("user_strikes").select("id", { count: "exact", head: true })
                .eq("user_id", r.reported_user_id)
                .is("voided_at", null)
                .gt("expires_at", new Date().toISOString())
            : Promise.resolve({ count: 0 }),
        ]);
        return {
          ...r,
          reporter_name: reporterP.data?.display_name ?? null,
          reporter_is_spam: (reporterPriv as any).data?.spam_reporter ?? false,
          target_name: (targetP as any).data?.display_name ?? null,
          target_status: (targetPriv as any).data?.account_status ?? null,
          target_active_strikes: (strikes as any).count ?? 0,
          post_snippet: (post as any).data?.content ?? null,
          post_media: await signPostMediaUrls(supabaseAdmin, (post as any).data?.media_urls ?? null),
          comment_snippet: (comment as any).data?.content ?? null,
          overdue: r.status === "pending" && new Date(r.sla_due_at) < new Date(),
        };
      }));

      return new Response(JSON.stringify({ data: enriched, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tab === "appeals") {
      const status = url.searchParams.get("status") || "pending";
      const { data, error } = await supabaseAdmin
        .from("user_appeals")
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

      // Cross-reference any pending appeals by email
      const emails = (data ?? []).map((b: any) => b.email).filter(Boolean);
      let appealsByEmail = new Map<string, string>();
      if (emails.length > 0) {
        const { data: appeals } = await supabaseAdmin
          .from("user_appeals")
          .select("id, email")
          .eq("status", "pending")
          .in("email", emails);
        appealsByEmail = new Map((appeals ?? []).map((a: any) => [a.email, a.id]));
      }
      const enriched = (data ?? []).map((b: any) => ({
        ...b,
        pending_appeal_id: appealsByEmail.get(b.email) ?? null,
      }));

      return new Response(JSON.stringify({ data: enriched, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tab === "subscriptions") {
      // PAID = source IN ('stripe','apple') AND plan != 'free'
      // GIFTED = source = 'admin_comp' (excluded from paid metrics)
      const { data: paidRows } = await supabaseAdmin
        .from("user_plans")
        .select("user_id, plan, source, cancel_at_period_end, current_period_end, extra_members, subscription_started_at")
        .in("source", ["stripe", "apple"])
        .neq("plan", "free");

      const paid = paidRows ?? [];
      const tiers = ["family", "extended", "founder"] as const;
      type Tier = typeof tiers[number];

      const empty = () => ({ stripe: 0, apple: 0, total: 0 });
      const emptyByTier = () => Object.fromEntries(tiers.map((t) => [t, 0])) as Record<Tier, number>;

      const active = { byPlatform: empty(), byTier: emptyByTier(), total: 0 };
      const canceled = { byPlatform: empty(), byTier: emptyByTier(), total: 0 };
      const durationBuckets = { lt30d: 0, d30_90: 0, d90_365: 0, gt365: 0 };
      const perUserPacks = { stripe: 0, apple: 0, total: 0 };

      const now = Date.now();
      const DAY = 86400 * 1000;

      for (const r of paid) {
        const platform = r.source === "apple" ? "apple" : "stripe";
        const tierKey = (tiers as readonly string[]).includes(r.plan) ? (r.plan as Tier) : null;
        const bucket = r.cancel_at_period_end ? canceled : active;
        bucket.byPlatform[platform]++;
        bucket.total++;
        if (tierKey) bucket.byTier[tierKey]++;

        // Per-user extra-member packs (count seats, attributed by platform)
        const seats = r.extra_members ?? 0;
        if (seats > 0) {
          perUserPacks[platform] += seats;
          perUserPacks.total += seats;
        }

        // Duration buckets for ACTIVE paid only
        if (!r.cancel_at_period_end && r.subscription_started_at) {
          const ageDays = (now - new Date(r.subscription_started_at).getTime()) / DAY;
          if (ageDays < 30) durationBuckets.lt30d++;
          else if (ageDays < 90) durationBuckets.d30_90++;
          else if (ageDays < 365) durationBuckets.d90_365++;
          else durationBuckets.gt365++;
        }
      }

      // Per-circle extra members packs (owner-attributed totals only — owner platform unknown without join)
      const { data: circleExtras } = await supabaseAdmin
        .from("circles")
        .select("id, extra_members")
        .gt("extra_members", 0);
      const perCirclePacks = {
        totalCircles: (circleExtras ?? []).length,
        totalExtraSeats: (circleExtras ?? []).reduce((sum: number, c: any) => sum + (c.extra_members ?? 0), 0),
      };

      // GIFTED (admin_comp) — informational, not mixed into paid metrics
      const { data: comps } = await supabaseAdmin
        .from("user_plans")
        .select("user_id, plan, comp_note, comped_by_admin_at")
        .eq("source", "admin_comp")
        .neq("plan", "free")
        .order("comped_by_admin_at", { ascending: false, nullsFirst: false })
        .limit(50);

      const giftedByTier = emptyByTier();
      for (const c of comps ?? []) {
        const tierKey = (tiers as readonly string[]).includes(c.plan) ? (c.plan as Tier) : null;
        if (tierKey) giftedByTier[tierKey]++;
      }

      // Hydrate recent comps with email
      const recentComps = (comps ?? []).slice(0, 10);
      const userIds = recentComps.map((c: any) => c.user_id);
      let emailById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        emailById = new Map(
          (usersList?.users ?? [])
            .filter((u: any) => userIds.includes(u.id))
            .map((u: any) => [u.id, u.email ?? ""]),
        );
      }
      const recent = recentComps.map((c: any) => ({
        user_id: c.user_id,
        email: emailById.get(c.user_id) ?? null,
        plan: c.plan,
        comp_note: c.comp_note,
        comped_by_admin_at: c.comped_by_admin_at,
      }));

      // Build paying customers list (email + display name), excluding comps
      const paidUserIds = paid.map((r: any) => r.user_id);
      const paidEmailById = new Map<string, string>();
      if (paidUserIds.length > 0) {
        for (let page = 1; page <= 10; page++) {
          const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
          const users = usersPage?.users ?? [];
          for (const u of users) {
            if (paidUserIds.includes(u.id)) paidEmailById.set(u.id, u.email ?? "");
          }
          if (users.length < 1000) break;
        }
      }
      const { data: paidProfiles } = paidUserIds.length > 0
        ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", paidUserIds)
        : { data: [] as any[] };
      const nameById = new Map<string, string>((paidProfiles ?? []).map((p: any) => [p.user_id, p.display_name]));

      const customers = paid
        .map((r: any) => ({
          user_id: r.user_id,
          email: paidEmailById.get(r.user_id) ?? null,
          display_name: nameById.get(r.user_id) ?? null,
          plan: r.plan,
          source: r.source,
          extra_members: r.extra_members ?? 0,
          cancel_at_period_end: r.cancel_at_period_end,
          current_period_end: r.current_period_end,
          subscription_started_at: r.subscription_started_at,
        }))
        .sort((a: any, b: any) => {
          const at = a.subscription_started_at ? new Date(a.subscription_started_at).getTime() : 0;
          const bt = b.subscription_started_at ? new Date(b.subscription_started_at).getTime() : 0;
          return bt - at;
        });

      return new Response(JSON.stringify({
        data: {
          paid: {
            active,
            canceled,
            durationBuckets,
            extraMembers: { perUserPacks, perCirclePacks },
            customers,
          },
          gifted: {
            active: { byTier: giftedByTier, total: (comps ?? []).length },
            recent,
          },
        },
      }), {
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
