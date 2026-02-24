

# Fix: Subscription Sync and Auto-Transfer-Block on Expiration

## Problems

1. **`check-subscription` doesn't sync `cancel_at_period_end` or `current_period_end`** -- it only upgrades the plan tier but ignores subscription metadata. This is why `friendsandbrett@gmail.com` shows `cancel_at_period_end: true` with `current_period_end: null` (stale data from a previous manual fix).

2. **No mechanism to auto-transfer-block overflow circles when a subscription actually expires.** If a user cancels and their period ends, their excess circles should be placed on the transfer block so members can claim them.

## Solution

### Part 1: Fix `check-subscription` to fully sync subscription state

**File: `supabase/functions/check-subscription/index.ts`**

The function currently only checks if the Stripe plan is higher than the DB plan. It needs to:

- Always sync `cancel_at_period_end` and `current_period_end` from the best active subscription, regardless of whether the plan tier changed
- If no active subscriptions exist but the DB still shows a paid plan, downgrade to free (subscription expired)
- When downgrading to free due to expiration, auto-transfer-block any overflow circles
- Always update the DB to match Stripe truth, not just on upgrades

Key changes:
- After finding the best subscription, extract `cancel_at_period_end` and `current_period_end` from that subscription
- Always update the `user_plans` row with the full set of fields: `plan`, `max_circles`, `max_members_per_circle`, `cancel_at_period_end`, `current_period_end`
- When no active subscriptions exist: set plan to `free`, clear cancellation fields, and transfer-block excess circles
- Return `synced: true` whenever any field was changed (not just plan tier)

### Part 2: Auto-transfer-block overflow circles on expiration

When `check-subscription` detects that a user's subscription has expired (no active subs in Stripe, but DB shows paid plan):

1. Set the user to the free plan (`max_circles: 1`, `max_members_per_circle: 8`)
2. Query circles owned by this user, sorted by `created_at` ascending
3. For any circles beyond the free limit (1), set `transfer_block = true`
4. This makes those circles read-only and allows members to claim ownership

This logic lives inside the `check-subscription` edge function itself, using the service role key.

### Part 3: Fix `friendsandbrett@gmail.com` immediately

Use the data insert tool to correct the record:
```sql
UPDATE user_plans
SET cancel_at_period_end = false, current_period_end = null, updated_at = now()
WHERE user_id = '59b40736-dbc2-48aa-9c78-4e4b7bfc78cd';
```

However, the next login will also auto-correct this via the improved `check-subscription` function, which will read the actual Stripe state (active, not canceling) and sync it.

## Technical Details

### `supabase/functions/check-subscription/index.ts` -- rewrite

```typescript
// After finding best subscription:
const bestSub = subscriptions.data.find(sub => 
  sub.items.data.some(item => PRICES[item.price.id]?.plan === bestPlan)
);
const cancelAtPeriodEnd = bestSub?.cancel_at_period_end ?? false;
const currentPeriodEnd = bestSub?.current_period_end 
  ? new Date(bestSub.current_period_end * 1000).toISOString() 
  : null;

// Always update to match Stripe (not just on upgrades)
await supabaseAdmin.from("user_plans").update({
  plan: bestPlan,
  max_circles: bestMaxCircles,
  max_members_per_circle: bestMaxMembers,
  cancel_at_period_end: cancelAtPeriodEnd,
  current_period_end: currentPeriodEnd,
  pending_plan: null,
  updated_at: new Date().toISOString(),
}).eq("user_id", user.id);
```

When no active subscriptions exist:
```typescript
// Downgrade to free
await supabaseAdmin.from("user_plans").update({
  plan: "free", max_circles: 1, max_members_per_circle: 8,
  cancel_at_period_end: false, current_period_end: null, pending_plan: null,
}).eq("user_id", user.id);

// Transfer-block overflow circles
const { data: ownedCircles } = await supabaseAdmin
  .from("circles")
  .select("id")
  .eq("owner_id", user.id)
  .eq("transfer_block", false)
  .order("created_at", { ascending: true });

if (ownedCircles && ownedCircles.length > 1) {
  const overflowIds = ownedCircles.slice(1).map(c => c.id);
  await supabaseAdmin.from("circles")
    .update({ transfer_block: true })
    .in("id", overflowIds);
}
```

### `supabase/config.toml` -- no change needed

`check-subscription` is not listed (defaults to `verify_jwt = true`), which is correct since the function validates the JWT manually.

### Files changed
- `supabase/functions/check-subscription/index.ts` -- full rewrite to sync all fields and handle expiration
- Database update for `friendsandbrett@gmail.com` via insert tool

