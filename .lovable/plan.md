
## Goal

Two adds to the admin console:
1. **Subscriptions analytics tab** — active vs canceled, split by Stripe / Apple, broken down by tier, duration, and extra-member packs. **Gifted (`admin_comp`) plans excluded from the paid metrics** and shown in a separate informational block.
2. **Banned + Appeals tooling** — the Appeals tab already grants/denies. Banned tab is currently read-only and missing an unban action and any appeal cross-reference. Wire those up.

---

## Current state (verified)

- `user_plans.source` values in DB: `stripe` (65), `apple` (4), `admin_comp` (16). This is the gift/paid discriminator.
- `user_plans` columns relevant: `plan`, `source`, `cancel_at_period_end`, `current_period_end`, `extra_members`, `apple_original_transaction_id`, `comped_by_admin_at`, `comp_note`.
- `circles.extra_members` also exists (per-circle add-on packs).
- **Missing**: `subscription_started_at` — we have no truthful column for "how long subscribed". `created_at` shifts when a row is upserted by tier changes.
- Admin.tsx already has tabs for Reports / Appeals / Banned / Audit / Metrics / Admins & Users.
- Appeals tab: grant button calls `admin-manage-users` with `restore_user` — works.
- Banned tab: read-only list of `banned_emails` rows — no unban, no appeal cross-reference.

---

## What we'll build

### 1. Schema (migration)

Add to `public.user_plans`:
- `subscription_started_at timestamptz`

Backfill: for rows where `source IN ('stripe','apple')` AND `plan != 'free'`, set `subscription_started_at = created_at` so existing accounts get a reasonable approximation immediately.

### 2. Set `subscription_started_at` on first paid activation

Edit these edge functions to set the column **only when it's NULL** (never overwrite, so tier upgrades don't reset the clock):
- `validate-apple-receipt` — on successful Apple verification
- `sync-stripe-purchases` — when first activating a paid Stripe plan
- `stripe-webhook` — `customer.subscription.created` handler

When a user cancels and resubscribes later, `subscription_started_at` keeps the original date unless the row was reset to `plan='free'` and back — acceptable for an internal metric.

### 3. Extend `admin-dashboard` edge function

Add a new `tab=subscriptions` branch (keep `tab=metrics` unchanged so the existing Metrics tab keeps working). Returns:

```ts
{
  paid: {
    active:    { byPlatform: { stripe: N, apple: N }, byTier: { family, extended, founder }, total },
    canceled:  { byPlatform: { stripe: N, apple: N }, byTier: {...}, total },  // cancel_at_period_end=true
    durationBuckets: { lt30d, d30_90, d90_365, gt365 },  // from subscription_started_at, active paid only
    extraMembers: {
      perUserPacks:   { stripe: N, apple: N, total },   // SUM(user_plans.extra_members) where source in stripe/apple
      perCirclePacks: { totalCircles: N, totalExtraSeats: N }, // SUM(circles.extra_members) — owner-attributed
    }
  },
  gifted: { // INFORMATIONAL, kept out of paid metrics
    active:    { byTier: {...}, total },
    recent:    [{ user_id, email, plan, comp_note, comped_by_admin_at }]  // last 10
  }
}
```

All paid queries: `WHERE source IN ('stripe','apple') AND plan != 'free'`.
Gifted queries: `WHERE source = 'admin_comp'`.

### 4. Add Subscriptions tab in `src/pages/Admin.tsx`

New `<TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>` between Metrics and Admins & Users. Renders:
- **Top row of cards**: Total Active Paid · Active Stripe · Active Apple · Canceling (cancel_at_period_end)
- **By tier table**: Family / Extended / Founder × Stripe / Apple, active vs canceling
- **Duration distribution**: 4 bars (<30d, 1–3mo, 3–12mo, >1yr)
- **Extra members panel**: per-user packs (by platform) + per-circle packs (totals)
- **Gifted section** (visually separated, muted): count by tier + recent comp list, with a label "Excluded from paid metrics"

### 5. Banned tab — add unban + appeal cross-reference

- Backend: add `unban_email` case to `admin-manage-users` (delete from `banned_emails` by id, write audit row).
- Backend: `admin-dashboard` `tab=banned` joins `user_appeals` by email and returns `pending_appeal_id` when present.
- Frontend Banned tab: show "Pending appeal" badge with a button "View appeal" that switches to Appeals tab; add **Unban** destructive button with confirm dialog.

### 6. Memory

Update `mem://business/subscription-enforcement` with: "`user_plans.source` discriminator: stripe / apple / admin_comp. Admin metrics exclude admin_comp from paid totals. `subscription_started_at` populated on first paid activation, never overwritten on tier change."

---

## Files touched

- New migration: `supabase/migrations/<ts>_subscription_started_at.sql`
- `supabase/functions/admin-dashboard/index.ts` — add `subscriptions` branch, enrich `banned` branch
- `supabase/functions/admin-manage-users/index.ts` — add `unban_email`
- `supabase/functions/validate-apple-receipt/index.ts` — set `subscription_started_at`
- `supabase/functions/sync-stripe-purchases/index.ts` — set `subscription_started_at`
- `supabase/functions/stripe-webhook/index.ts` — set `subscription_started_at`
- `src/pages/Admin.tsx` — new Subscriptions tab, Banned tab unban/appeal-link
- `mem://business/subscription-enforcement` — note the discriminator + column

## Out of scope

- Live Stripe/Apple API lookups per render (would be slow). We rely on the DB columns kept in sync by the existing webhook/sync paths.
- MRR / revenue dollars — not requested; can add later by joining tier → price map.
- Historical churn over time / charts — current request is "report active vs canceled" not time-series. Can add with a simple sparkline later if you want.
