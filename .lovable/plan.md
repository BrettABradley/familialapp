

# Streamlined Payments, Per-Circle Extra Members, and Account Upgrades

## Overview
This plan addresses several interconnected issues: the "Buy Now" buttons on the landing page just redirect to login without completing a purchase, accounts don't seamlessly upgrade after payment, and the $5 extra member pack needs to work for ALL tiers and be assigned to a specific circle.

## What Changes

### 1. Landing Page "Buy Now" Buttons -- Smart Checkout Flow
Currently, all pricing buttons link to `/auth`. Instead:
- **Logged-in users**: Clicking "Buy Now" immediately opens Stripe checkout for that plan
- **Not logged-in users**: Redirected to `/auth?plan=family` (or `extended`), and after login/signup, checkout is automatically triggered

### 2. Auth Page -- Post-Login Checkout Trigger
- Read `?plan=family` or `?plan=extended` from the URL after successful login
- Automatically call `create-checkout` with the correct price ID and redirect to Stripe

### 3. Extra Members Available on ALL Tiers
- The "$5 for 7 extra members" option will appear in the upgrade dialog for free, family, AND extended plans (not just extended)
- Update the pricing landing page to show this option on all tiers

### 4. Per-Circle Extra Members (Database Change)
- Add an `extra_members` column to the `circles` table (default 0)
- When someone buys extra members, those 7 slots are assigned to the specific circle they selected
- Update the webhook to increment `circles.extra_members` for that circle instead of the global `user_plans.extra_members`
- Update `circleLimits.ts` to factor in per-circle extra members

### 5. Account Actually Upgrades After Purchase
- The webhook already handles plan upgrades -- verify and fix the token-based auth pattern
- After checkout success, the Circles page will re-fetch plan data so changes appear immediately

---

## Technical Details

### Database Migration
```sql
ALTER TABLE public.circles ADD COLUMN extra_members integer NOT NULL DEFAULT 0;
```
- RLS: Owners can already update their circles, no new policies needed
- The webhook uses the service role key, so it bypasses RLS

### Files Modified

| File | Change |
|------|--------|
| `src/components/landing/Pricing.tsx` | Add `useAuth` hook; logged-in users get direct checkout, others go to `/auth?plan=X`. Show extra members option on all tiers. |
| `src/pages/Auth.tsx` | Read `plan` query param; after successful login, auto-trigger checkout via `create-checkout` edge function |
| `src/components/circles/UpgradePlanDialog.tsx` | Show "Add 7 Extra Members" option for ALL plans (free, family, extended), not just extended |
| `src/lib/circleLimits.ts` | Update `getCircleMemberLimit` to also query `circles.extra_members` for the specific circle and add it to the limit |
| `supabase/functions/stripe-webhook/index.ts` | For extra members payment, update `circles.extra_members` on the specific circle (from `session.metadata.circle_id`) instead of global `user_plans.extra_members` |
| `src/pages/Circles.tsx` | After `?checkout=success` query param, re-fetch member info to reflect new limits |

### Payment Flow Diagram

```text
Landing Page "Buy Now"
  |
  +-- Logged in? --> Call create-checkout --> Stripe Checkout --> Webhook upgrades account --> /circles?checkout=success
  |
  +-- Not logged in? --> /auth?plan=family --> Login/Signup --> Auto-call create-checkout --> Stripe Checkout --> same flow
```

### Webhook Changes for Per-Circle Extra Members
- Read `circle_id` from `session.metadata.circle_id`
- Instead of incrementing `user_plans.extra_members`, increment `circles.extra_members` for that specific circle
- Keep the global `user_plans.extra_members` for backward compatibility but per-circle is the primary mechanism going forward

### Circle Limit Calculation Update
```text
limit = owner_plan.max_members_per_circle + circle.extra_members
```
This replaces the current formula that uses global `user_plans.extra_members`.

