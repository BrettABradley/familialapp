

# Fix: Founder Plan Being Overwritten by Stripe Sync

## Problem

Your account was set to the "founder" plan, but every time you log in, the `check-subscription` function syncs your plan from Stripe. Since Stripe has no "founder" subscription, it overwrites your plan back to whatever Stripe says (currently "family" with `cancel_at_period_end: true`, which then becomes "free"). The `stripe-webhook` function has the same issue on subscription deletion events.

## What needs to change

### 1. Database: Re-apply the founder plan

Run a migration to set your account back to founder with unlimited limits:

```sql
UPDATE user_plans 
SET plan = 'founder', 
    max_circles = 999999, 
    max_members_per_circle = 999999,
    cancel_at_period_end = false,
    current_period_end = null,
    pending_plan = null,
    updated_at = now() 
WHERE user_id = '59b40736-dbc2-48aa-9c78-4e4b7bfc78cd';
```

### 2. Edge Function: `check-subscription/index.ts`

Add an early return after authentication that checks if the user is on the founder plan. If so, skip all Stripe sync logic and return immediately:

```typescript
// After authenticating the user (line ~41), before Stripe logic:
const { data: currentPlan } = await supabaseAdmin
  .from("user_plans")
  .select("plan")
  .eq("user_id", user.id)
  .maybeSingle();

if (currentPlan?.plan === "founder") {
  log("Founder plan detected — skipping Stripe sync", { userId: user.id });
  return new Response(JSON.stringify({ synced: true, plan: "founder" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 3. Edge Function: `stripe-webhook/index.ts`

In the `customer.subscription.deleted` handler (~line 366), add a founder check before downgrading:

```typescript
// Before the downgrade update:
const { data: planCheck } = await supabase
  .from("user_plans")
  .select("plan")
  .eq("user_id", userId)
  .maybeSingle();

if (planCheck?.plan === "founder") {
  console.log("[STRIPE-WEBHOOK] Founder plan — skipping downgrade");
  return new Response(JSON.stringify({ received: true }), { ... });
}
```

### 4. Also protect `syncToFree` in check-subscription

The `syncToFree` helper (line 163) is called when no Stripe customer is found. Add a founder guard there too — already covered by the early return in step 2.

### 5. Unblock read-only circles

Your circles are likely on `transfer_block = true` from the erroneous downgrade. Fix with migration:

```sql
UPDATE circles 
SET transfer_block = false 
WHERE owner_id = '59b40736-dbc2-48aa-9c78-4e4b7bfc78cd' 
AND transfer_block = true;
```

## Files to modify
- `supabase/functions/check-subscription/index.ts` — add founder early-return
- `supabase/functions/stripe-webhook/index.ts` — add founder guard on subscription deletion
- New migration — re-apply founder plan + unblock circles

