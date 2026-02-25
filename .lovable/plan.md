

## Fix: Founder Plan Applied to Wrong User ID

### What I found
The database currently has:
- `59b40736-dbc2-48aa-9c78-4e4b7bfc78cd` → **founder** (this is an old/test account)
- `ce44fd23-ea57-4719-89c3-341c7b755096` → **free** (this is your active account for brettbradley007@gmail.com)

The founder plan was applied to the wrong user ID. Your real active account is still on "free", so the founder guard in `check-subscription` never triggers and Stripe sync keeps overwriting it.

### Changes needed

#### 1. Data fix (SQL via insert tool)

Update the correct user to founder and revert the old one:

```sql
-- Set the CORRECT active account to founder
UPDATE user_plans 
SET plan = 'founder', 
    max_circles = 999999, 
    max_members_per_circle = 999999,
    cancel_at_period_end = false,
    current_period_end = null,
    pending_plan = null,
    updated_at = now() 
WHERE user_id = 'ce44fd23-ea57-4719-89c3-341c7b755096';

-- Revert the old/wrong account back to free
UPDATE user_plans 
SET plan = 'free', 
    max_circles = 1, 
    max_members_per_circle = 8 
WHERE user_id = '59b40736-dbc2-48aa-9c78-4e4b7bfc78cd';

-- Clear any transfer blocks on your circles
UPDATE circles 
SET transfer_block = false 
WHERE owner_id = 'ce44fd23-ea57-4719-89c3-341c7b755096' 
AND transfer_block = true;
```

#### 2. Add founder guard to `customer.subscription.updated` handler

**File**: `supabase/functions/stripe-webhook/index.ts`

After the `userId` lookup (line 309), before the `periodEnd` line (line 311), insert a founder check that short-circuits the handler — identical pattern to the existing guard on `customer.subscription.deleted`:

```typescript
// Check if user is on founder plan — never overwrite founders
const { data: planCheck } = await supabase
  .from("user_plans")
  .select("plan")
  .eq("user_id", userId)
  .maybeSingle();

if (planCheck?.plan === "founder") {
  console.log(`[STRIPE-WEBHOOK] Founder plan detected for user ${userId} — skipping subscription.updated`);
  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

This ensures all three Stripe event paths are protected:
- `checkout.session.completed` — no issue (uses metadata user_id, won't match founder)
- `customer.subscription.updated` — **adding guard now**
- `customer.subscription.deleted` — already guarded

#### 3. No other file changes needed

The `check-subscription` early return is already in place and will work correctly once the correct user ID has the founder plan.

### Files to modify
- `supabase/functions/stripe-webhook/index.ts` — add founder guard in `subscription.updated` handler (1 insertion, ~12 lines)
- Database — 3 UPDATE statements via insert tool

### Why only one founder
The old user ID (`59b40736...`) gets reverted to free. Only `ce44fd23...` (your active brettbradley007@gmail.com account) will hold the founder plan — exactly 1 of 1.

