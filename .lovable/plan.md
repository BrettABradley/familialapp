# Restrict Extra Member Purchases to Subscribers

## Goal
Selling "+7 seats for $5" on Free-plan circles undermines the subscription model. Lock that purchase to circle owners with an active paid subscription. Existing extras remain (grandfathered).

## Eligibility Rule
A circle is eligible to buy +7 extra seats **only if the circle's OWNER** has one of these plans:
- `family`
- `extended`
- `enterprise`
- `founder`
- Any plan with `comped_by_admin_at` set (admin comp)
- Apple-sourced subscription (`source = 'apple'`) on family/extended

Free plan owners → button disabled with label **"Subscription required to add seats"** and a tap opens `/upgrade`.

Grandfathering: we do nothing to existing `circles.extra_members` values — they stay. The rule only blocks NEW purchases going forward.

## Changes

### 1. Frontend — `src/pages/Circles.tsx` (Members dialog)
- Fetch the circle owner's plan via a new SECURITY DEFINER RPC `can_buy_extra_seats(_circle_id uuid) returns boolean` (returns true if owner plan is paid/comped/enterprise/founder).
- If `false`: render disabled button labeled **"Subscription required to add seats"**; clicking it navigates to `/upgrade` (only for the circle owner — non-owners just see disabled with a hint "Ask the owner to upgrade").
- If `true`: existing "Add 7 Extra Members — $5" button works as today.

### 2. Frontend — `src/components/circles/UpgradePlanDialog.tsx`
- Hide / disable the "Add 7 Extra Members" tile when the user's own plan is `free`. Show inline note pointing them to a paid plan first.

### 3. Backend — Stripe path: `supabase/functions/create-checkout/index.ts`
- When `priceId === extra-members price` AND `circleId` provided: look up the circle's owner's `user_plans` row. If plan is `free` and not comped → return 403 with `{ error: "SUBSCRIPTION_REQUIRED" }`.

### 4. Backend — iOS IAP: `supabase/functions/validate-apple-receipt/index.ts`
- Before crediting `extra_members` for `kind === "extra_members"`: same owner-plan check. If ineligible → don't credit, refund-style response (record in `apple_iap_grants` with `status = 'rejected_no_subscription'` so we don't retry), and surface a clear client error.

### 5. Backend — Google Play: `supabase/functions/validate-google-receipt/index.ts`
- Mirror the Apple check.

### 6. DB — new helper function (migration)
```sql
create or replace function public.can_buy_extra_seats(_circle_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_plan text; v_comped timestamptz; v_source text;
begin
  select owner_id into v_owner from circles where id = _circle_id;
  if v_owner is null then return false; end if;
  select plan, comped_by_admin_at, source into v_plan, v_comped, v_source
    from user_plans where user_id = v_owner;
  return v_plan in ('family','extended','enterprise','founder')
      or v_comped is not null
      or v_source in ('admin_comp','apple','enterprise');
end $$;
grant execute on function public.can_buy_extra_seats(uuid) to authenticated;
```

## Out of Scope
- No changes to existing `extra_members` counts on any circle.
- No refunds for past Free-plan purchases.
- Per-seat pricing stays at $5 / 7 seats.

## Open Question
None — confirming the rule set above matches your intent. Ready to implement on approval.
