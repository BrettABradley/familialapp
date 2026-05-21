// Consolidated admin endpoint for the Admins & Users tab.
// All operations are admin-gated, audit-logged, and respect the
// "free-tier-only" rule for comps so paying customers are never overwritten.
import { corsHeaders, jsonResponse, requireAdmin, logAdminAction } from "../_shared/admin-guard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PLAN_LIMITS: Record<string, { max_circles: number; max_members_per_circle: number }> = {
  free: { max_circles: 1, max_members_per_circle: 8 },
  family: { max_circles: 1, max_members_per_circle: 20 },
  extended: { max_circles: 1, max_members_per_circle: 35 },
};

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");

async function stripeActiveSub(customerEmail: string | null): Promise<string | null> {
  if (!STRIPE_KEY || !customerEmail) return null;
  try {
    const custRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(customerEmail)}&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } },
    );
    const custJson = await custRes.json();
    const customer = custJson.data?.[0];
    if (!customer) return null;
    const subRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=all&limit=5`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } },
    );
    const subJson = await subRes.json();
    const active = (subJson.data ?? []).find((s: any) =>
      ["active", "trialing", "past_due", "incomplete"].includes(s.status)
    );
    return active ? active.status : null;
  } catch (e) {
    console.error("Stripe lookup failed", e);
    return null;
  }
}

async function sendTemplateEmail(
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { requested: true, queued: false, error: "Email service is not configured" };
  }

  try {
    const url = `${supabaseUrl}/functions/v1/send-transactional-email`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ templateName, recipientEmail, templateData, idempotencyKey }),
    });
    const text = await res.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!res.ok || payload?.error) {
      const error = payload?.error ?? text ?? `HTTP ${res.status}`;
      console.error(`${templateName} email failed`, { recipientEmail, error });
      return { requested: true, queued: false, error };
    }
    if (payload?.reason === "email_suppressed") {
      return { requested: true, queued: false, suppressed: true };
    }
    return { requested: true, queued: true };
  } catch (e) {
    console.error(`${templateName} email failed`, e);
    return { requested: true, queued: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const skippedEmail = (requested = false, error?: string) => ({ requested, queued: false, error });

const sendGiftEmail = (recipientEmail: string, name: string | null, idempotencyKey: string) =>
  sendTemplateEmail("founder-gift", recipientEmail, { name: name ?? undefined }, idempotencyKey);


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;
  const { supabaseAdmin, user: admin } = guard;
  const adminEmail = admin.email ?? "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const action = body.action as string;
  if (!action) return jsonResponse({ error: "action required" }, 400);

  try {
    switch (action) {
      // ============ MODERATORS ============
      case "list_moderators": {
        const { data } = await supabaseAdmin.from("platform_admins").select("*");
        const enriched = await Promise.all((data ?? []).map(async (row: any) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          const { data: p } = await supabaseAdmin.from("profiles")
            .select("display_name").eq("user_id", row.user_id).maybeSingle();
          return { ...row, email: u?.user?.email, display_name: p?.display_name };
        }));
        return jsonResponse({ moderators: enriched });
      }

      case "add_moderator": {
        const email = String(body.email ?? "").toLowerCase().trim();
        if (!email) return jsonResponse({ error: "email required" }, 400);
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const target = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
        if (!target) return jsonResponse({ error: "No account found for that email" }, 404);
        const { error } = await supabaseAdmin.from("platform_admins").insert({
          user_id: target.id, granted_by: admin.id, note: body.note ?? null,
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        await logAdminAction(supabaseAdmin, adminEmail, "add_moderator", {
          target_user_id: target.id, details: { email },
        });
        return jsonResponse({ ok: true });
      }

      case "remove_moderator": {
        const target_user_id = String(body.user_id ?? "");
        if (!target_user_id) return jsonResponse({ error: "user_id required" }, 400);
        if (target_user_id === admin.id) return jsonResponse({ error: "You cannot remove yourself" }, 400);
        const { error } = await supabaseAdmin.from("platform_admins").delete().eq("user_id", target_user_id);
        if (error) return jsonResponse({ error: error.message }, 400);
        await logAdminAction(supabaseAdmin, adminEmail, "remove_moderator", { target_user_id });
        return jsonResponse({ ok: true });
      }

      // ============ USER LOOKUP & COMPS ============
      case "lookup_user": {
        const q = String(body.query ?? "").toLowerCase().trim();
        if (!q) return jsonResponse({ users: [] });
        // Search profiles by display_name
        const { data: profileMatches } = await supabaseAdmin.from("profiles")
          .select("user_id, display_name, account_status")
          .ilike("display_name", `%${q}%`).limit(20);
        // Search auth users by email
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const emailMatches = (authList?.users ?? []).filter((u: any) =>
          u.email?.toLowerCase().includes(q)
        ).slice(0, 20);

        const userIds = new Set<string>();
        (profileMatches ?? []).forEach((p: any) => userIds.add(p.user_id));
        emailMatches.forEach((u: any) => userIds.add(u.id));

        const results = await Promise.all(Array.from(userIds).slice(0, 25).map(async (uid) => {
          const authUser = (authList?.users ?? []).find((u: any) => u.id === uid);
          const { data: profile } = await supabaseAdmin.from("profiles")
            .select("display_name, account_status").eq("user_id", uid).maybeSingle();
          const { data: plan } = await supabaseAdmin.from("user_plans")
            .select("*").eq("user_id", uid).maybeSingle();
          const { count: circlesOwned } = await supabaseAdmin.from("circles")
            .select("id", { count: "exact", head: true }).eq("owner_id", uid);
          const stripe_status = await stripeActiveSub(authUser?.email ?? null);
          return {
            user_id: uid,
            email: authUser?.email,
            display_name: profile?.display_name,
            account_status: profile?.account_status,
            created_at: authUser?.created_at,
            plan: plan?.plan ?? "free",
            comped_by_admin_at: plan?.comped_by_admin_at ?? null,
            comp_note: plan?.comp_note ?? null,
            max_circles: plan?.max_circles,
            max_members_per_circle: plan?.max_members_per_circle,
            circles_owned: circlesOwned ?? 0,
            stripe_status, // null | active | trialing | past_due | incomplete
          };
        }));
        return jsonResponse({ users: results });
      }

      case "list_comps": {
        const { data: plans } = await supabaseAdmin.from("user_plans")
          .select("*").not("comped_by_admin_at", "is", null)
          .order("comped_by_admin_at", { ascending: false });
        const enriched = await Promise.all((plans ?? []).map(async (p: any) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
          const { data: prof } = await supabaseAdmin.from("profiles")
            .select("display_name").eq("user_id", p.user_id).maybeSingle();
          // Reach stats: circles they own + total non-owner members across those circles
          const { data: ownedCircles } = await supabaseAdmin.from("circles")
            .select("id").eq("owner_id", p.user_id);
          const circleIds = (ownedCircles ?? []).map((c: any) => c.id);
          let membersBroughtIn = 0;
          if (circleIds.length > 0) {
            const { count } = await supabaseAdmin
              .from("circle_memberships")
              .select("user_id", { count: "exact", head: true })
              .in("circle_id", circleIds)
              .neq("user_id", p.user_id);
            membersBroughtIn = count ?? 0;
          }
          return {
            user_id: p.user_id, plan: p.plan,
            comped_by_admin_at: p.comped_by_admin_at, comp_note: p.comp_note,
            email: u?.user?.email, display_name: prof?.display_name,
            circles_owned: circleIds.length,
            members_brought_in: membersBroughtIn,
          };
        }));
        return jsonResponse({ comps: enriched });
      }

      case "comp_plan": {
        const target_user_id = String(body.user_id ?? "");
        const plan = String(body.plan ?? "");
        const note = body.note ? String(body.note) : null;
        const send_email = body.send_gift_email !== false;
        if (!target_user_id || !["family", "extended"].includes(plan)) {
          return jsonResponse({ error: "user_id and plan (family|extended) required" }, 400);
        }
        // Guardrail: current plan must be 'free' AND no active Stripe sub
        const { data: existing } = await supabaseAdmin.from("user_plans")
          .select("plan, comped_by_admin_at").eq("user_id", target_user_id).maybeSingle();
        if (existing && existing.plan !== "free") {
          return jsonResponse({ error: `User is already on '${existing.plan}'. Comp only available for free users.` }, 409);
        }
        const { data: targetAuth } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
        const stripe_status = await stripeActiveSub(targetAuth?.user?.email ?? null);
        if (stripe_status) {
          return jsonResponse({ error: `User has an ${stripe_status} Stripe subscription. Comp blocked.` }, 409);
        }
        const limits = PLAN_LIMITS[plan];
        const compedAt = new Date().toISOString();
        const upsertRow = {
          user_id: target_user_id,
          plan,
          max_circles: limits.max_circles,
          max_members_per_circle: limits.max_members_per_circle,
          comped_by_admin_at: compedAt,
          comp_note: note,
          source: "admin_comp",
          updated_at: new Date().toISOString(),
        };
        const { error: upErr } = await supabaseAdmin.from("user_plans").upsert(upsertRow);
        if (upErr) return jsonResponse({ error: upErr.message }, 400);

        // In-app notification
        await supabaseAdmin.from("notifications").insert({
          user_id: target_user_id,
          type: "gift",
          title: "A gift from the founder",
          message: `You've been upgraded to ${plan === "family" ? "Family" : "Extended"} on the house. Enjoy!`,
        });

        let email_result = skippedEmail(send_email, send_email && !targetAuth?.user?.email ? "Target user has no email address" : undefined);
        if (send_email && targetAuth?.user?.email) {
          const { data: prof } = await supabaseAdmin.from("profiles")
            .select("display_name").eq("user_id", target_user_id).maybeSingle();
          email_result = await sendGiftEmail(
            targetAuth.user.email,
            prof?.display_name ?? null,
            `founder-gift-${target_user_id}-${compedAt}`,
          );
        }

        await logAdminAction(supabaseAdmin, adminEmail, "comp_plan", {
          target_user_id, details: { plan, note, send_email, email_result },
        });
        return jsonResponse({ ok: true, email: email_result });
      }

      case "revoke_comp": {
        const target_user_id = String(body.user_id ?? "");
        if (!target_user_id) return jsonResponse({ error: "user_id required" }, 400);
        const { data: existing } = await supabaseAdmin.from("user_plans")
          .select("comped_by_admin_at, plan").eq("user_id", target_user_id).maybeSingle();
        if (!existing?.comped_by_admin_at) {
          return jsonResponse({ error: "User is not on a comped plan" }, 409);
        }
        const free = PLAN_LIMITS.free;
        const { error } = await supabaseAdmin.from("user_plans").update({
          plan: "free",
          max_circles: free.max_circles,
          max_members_per_circle: free.max_members_per_circle,
          comped_by_admin_at: null,
          comp_note: null,
          source: "admin_revoke",
          updated_at: new Date().toISOString(),
        }).eq("user_id", target_user_id);
        if (error) return jsonResponse({ error: error.message }, 400);
        await logAdminAction(supabaseAdmin, adminEmail, "revoke_comp", {
          target_user_id, details: { previous_plan: existing.plan },
        });
        return jsonResponse({ ok: true });
      }

      // ============ ENTERPRISE ============
      case "list_enterprise": {
        const { data } = await supabaseAdmin.from("enterprise_accounts")
          .select("*").order("created_at", { ascending: false });
        const enriched = await Promise.all((data ?? []).map(async (row: any) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          const { data: prof } = await supabaseAdmin.from("profiles")
            .select("display_name").eq("user_id", row.user_id).maybeSingle();
          const { data: plan } = await supabaseAdmin.from("user_plans")
            .select("max_circles, max_members_per_circle, plan")
            .eq("user_id", row.user_id).maybeSingle();
          return {
            ...row,
            account_email: u?.user?.email,
            display_name: prof?.display_name,
            max_circles: plan?.max_circles,
            max_members_per_circle: plan?.max_members_per_circle,
            plan: plan?.plan,
          };
        }));
        return jsonResponse({ enterprise: enriched });
      }

      case "upsert_enterprise": {
        const target_user_id = String(body.user_id ?? "");
        const max_circles = Number(body.max_circles);
        const max_members_per_circle = Number(body.max_members_per_circle);
        const contact_email = String(body.contact_email ?? "");
        const agreed_price_cents = Number(body.agreed_price_cents ?? 0);
        const billing_cadence = String(body.billing_cadence ?? "monthly");
        const next_invoice_due_at = body.next_invoice_due_at || null;
        const notes = body.notes ? String(body.notes) : null;
        const is_new = !!body.is_new;
        const send_email = body.send_gift_email === true;

        if (!target_user_id || !contact_email) return jsonResponse({ error: "user_id and contact_email required" }, 400);
        if (!Number.isFinite(max_circles) || max_circles < 1 || max_circles > 10000)
          return jsonResponse({ error: "max_circles must be 1–10000" }, 400);
        if (!Number.isFinite(max_members_per_circle) || max_members_per_circle < 1 || max_members_per_circle > 10000)
          return jsonResponse({ error: "max_members_per_circle must be 1–10000" }, 400);
        if (!["monthly", "annual", "custom"].includes(billing_cadence))
          return jsonResponse({ error: "billing_cadence must be monthly|annual|custom" }, 400);

        if (is_new) {
          // Free-tier guard on creation
          const { data: existing } = await supabaseAdmin.from("user_plans")
            .select("plan").eq("user_id", target_user_id).maybeSingle();
          if (existing && existing.plan !== "free") {
            return jsonResponse({ error: `User is on '${existing.plan}'. Enterprise creation only allowed for free users.` }, 409);
          }
          const { data: targetAuth } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
          const stripe_status = await stripeActiveSub(targetAuth?.user?.email ?? null);
          if (stripe_status) return jsonResponse({ error: `User has an ${stripe_status} Stripe subscription. Cannot convert to enterprise.` }, 409);
        }

        const operationId = crypto.randomUUID();

        // Upsert user_plans → enterprise
        const { error: planErr } = await supabaseAdmin.from("user_plans").upsert({
          user_id: target_user_id,
          plan: "enterprise",
          max_circles,
          max_members_per_circle,
          source: "enterprise",
          updated_at: new Date().toISOString(),
        });
        if (planErr) return jsonResponse({ error: planErr.message }, 400);

        // Upsert enterprise_accounts (by user_id unique)
        const { data: existingEnt } = await supabaseAdmin.from("enterprise_accounts")
          .select("id").eq("user_id", target_user_id).maybeSingle();
        const payload = {
          user_id: target_user_id,
          contact_email, agreed_price_cents, currency: "USD", billing_cadence,
          next_invoice_due_at, notes,
          created_by: admin.id,
          updated_at: new Date().toISOString(),
        };
        if (existingEnt) {
          await supabaseAdmin.from("enterprise_accounts").update(payload).eq("id", existingEnt.id);
        } else {
          await supabaseAdmin.from("enterprise_accounts").insert(payload);
        }

        let welcome_email_result = skippedEmail(false);
        let gift_email_result = skippedEmail(send_email);

        if (is_new) {
          const { data: targetAuth } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
          const { data: prof } = await supabaseAdmin.from("profiles")
            .select("display_name").eq("user_id", target_user_id).maybeSingle();
          const recipient = targetAuth?.user?.email ?? contact_email;
          welcome_email_result = skippedEmail(true, recipient ? undefined : "Target user has no email address");
          if (recipient) {
            welcome_email_result = await sendTemplateEmail("enterprise-welcome", recipient, {
              name: prof?.display_name ?? undefined,
              contactEmail: contact_email,
            }, `enterprise-welcome-${target_user_id}-${operationId}`);
          }
          gift_email_result = skippedEmail(send_email, send_email && !targetAuth?.user?.email ? "Target user has no email address" : undefined);
          if (send_email && targetAuth?.user?.email) {
            gift_email_result = await sendGiftEmail(
              targetAuth.user.email,
              prof?.display_name ?? null,
              `founder-gift-enterprise-${target_user_id}-${operationId}`,
            );
          }
          // In-app notification bell entry
          await supabaseAdmin.from("notifications").insert({
            user_id: target_user_id,
            type: "enterprise_activated",
            title: "Your account has been upgraded to Enterprise",
            message: `You now have access to ${max_circles} circles with up to ${max_members_per_circle} members each. Welcome to Familial Enterprise.`,
            link: "/settings",
          });
        }

        await logAdminAction(supabaseAdmin, adminEmail, is_new ? "create_enterprise" : "update_enterprise", {
          target_user_id, details: { max_circles, max_members_per_circle, agreed_price_cents, billing_cadence, next_invoice_due_at, send_email, welcome_email_result: is_new ? welcome_email_result : undefined, gift_email_result: is_new ? gift_email_result : undefined },
        });
        return jsonResponse({ ok: true, welcome_email: is_new ? welcome_email_result : undefined, gift_email: is_new ? gift_email_result : undefined });
      }

      case "mark_invoice_sent": {
        const id = String(body.enterprise_account_id ?? "");
        if (!id) return jsonResponse({ error: "enterprise_account_id required" }, 400);
        const { data: row } = await supabaseAdmin.from("enterprise_accounts")
          .select("*").eq("id", id).maybeSingle();
        if (!row) return jsonResponse({ error: "Not found" }, 404);
        const base = row.next_invoice_due_at ? new Date(row.next_invoice_due_at) : new Date();
        let next = new Date(base);
        if (row.billing_cadence === "monthly") next.setMonth(next.getMonth() + 1);
        else if (row.billing_cadence === "annual") next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1); // custom defaults to monthly bump
        await supabaseAdmin.from("enterprise_accounts").update({
          next_invoice_due_at: next.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        await logAdminAction(supabaseAdmin, adminEmail, "mark_invoice_sent", {
          target_user_id: row.user_id,
          details: { enterprise_account_id: id, previous_due: row.next_invoice_due_at, new_due: next.toISOString() },
        });
        return jsonResponse({ ok: true, next_invoice_due_at: next.toISOString() });
      }

      case "remove_enterprise": {
        const target_user_id = String(body.user_id ?? "");
        if (!target_user_id) return jsonResponse({ error: "user_id required" }, 400);
        await supabaseAdmin.from("enterprise_accounts").delete().eq("user_id", target_user_id);
        const free = PLAN_LIMITS.free;
        await supabaseAdmin.from("user_plans").update({
          plan: "free",
          max_circles: free.max_circles,
          max_members_per_circle: free.max_members_per_circle,
          source: "admin_revoke",
          updated_at: new Date().toISOString(),
        }).eq("user_id", target_user_id);
        await logAdminAction(supabaseAdmin, adminEmail, "remove_enterprise", { target_user_id });
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    console.error("admin-manage-users error", e);
    return jsonResponse({ error: e.message ?? "Internal error" }, 500);
  }
});
