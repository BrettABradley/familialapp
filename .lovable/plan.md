

## Plan: Backfill Upgrade Receipts and Add Cancel Downgrade Flow

### Overview
Two changes:
1. **Backfill upgrade receipts** -- Send receipt emails to users who upgraded (via the `upgrade-subscription` function) but didn't receive a confirmation email because the receipt feature was added after their upgrade.
2. **Cancel Downgrade button** -- Allow users who have a pending downgrade (Extended to Family) to reverse it with a clear, seamless UI on both the Pricing page and Settings Subscription card.

---

### 1. Backfill Upgrade Receipts

The existing `send-past-receipts` function only covers Stripe Checkout sessions. It misses subscription updates (upgrades) that were processed via `upgrade-subscription`. 

**Approach:** Modify `supabase/functions/send-past-receipts/index.ts` to also iterate through Stripe invoices with `billing_reason: "subscription_update"`. These are the prorated invoices generated when someone upgrades. For each paid invoice of this type, send a receipt email with the actual amount charged.

**Changes to `supabase/functions/send-past-receipts/index.ts`:**
- After processing checkout sessions, add a second pass that lists Stripe invoices with `billing_reason: "subscription_update"` and `status: "paid"`
- For each, extract the customer email, amount paid, and date
- Send a receipt email using the same branded template with "Upgrade (prorated)" as the item description
- Track processed invoice IDs to avoid duplicates

---

### 2. Cancel Downgrade Flow

Currently, when a user downgrades from Extended to Family, the Stripe subscription price is changed immediately with `proration_behavior: "none"`, and `pending_plan: "family"` is set in `user_plans`. There's no way to reverse this.

**New edge function: `supabase/functions/cancel-downgrade/index.ts`**
- Authenticates the user
- Finds their active Stripe subscription
- Checks that the current price is the Family price (confirming a downgrade happened)
- Switches the price back to Extended with `proration_behavior: "none"` (no extra charge since they already paid for Extended this period)
- Updates `user_plans`: clears `pending_plan`, restores `plan: "extended"`, `max_circles: 3`, `max_members_per_circle: 35`
- Deletes any open rescue offers the user created for this downgrade
- Returns success with the current period end

**Config: `supabase/config.toml`**
- Add `[functions.cancel-downgrade]` with `verify_jwt = false`

**Frontend: `src/components/landing/Pricing.tsx`**
- When `pendingPlan` is set (e.g., "family"), the Extended tier card currently shows "Current Tier" (disabled). Instead:
  - On the **Extended card** (the plan they're downgrading FROM): show a "Cancel Downgrade" button
  - When clicked, show an AlertDialog: "Are you sure? You'll continue on the Extended plan at $15/month, charged on your regular billing schedule."
  - On confirm, call `cancel-downgrade`, update local state to clear `pendingPlan`
- On the **Family card** (the pending plan): show "Downgrade Pending" (disabled) -- this already works

**Frontend: `src/components/settings/SubscriptionCard.tsx`**
- When `planData.pending_plan` is set and `cancel_at_period_end` is false (a downgrade, not a cancellation):
  - Show a "Cancel Downgrade" button alongside the existing UI
  - Same confirmation dialog and edge function call as the pricing page
  - On success, clear `pending_plan` from local state and show a success toast

---

### Technical Details

**New file: `supabase/functions/cancel-downgrade/index.ts`**
- Auth + Stripe customer lookup (same pattern as other functions)
- Switch subscription item price back to Extended (`price_1T3N5nCiWDzualH5SBHxbHqo`) with `proration_behavior: "none"`
- Update `user_plans`: `pending_plan: null`, `plan: "extended"`, `max_circles: 3`, `max_members_per_circle: 35`
- Delete open `circle_rescue_offers` where `current_owner = user.id` and `status = "open"`

**Modified: `supabase/functions/send-past-receipts/index.ts`**
- Add second loop after checkout session processing:
  - `stripe.invoices.list({ status: "paid", limit: 100 })` with pagination
  - Filter for `billing_reason === "subscription_update"` and `amount_paid > 0`
  - Extract email from the associated customer
  - Send receipt with "Plan Upgrade (prorated)" description and actual amount

**Modified: `src/components/landing/Pricing.tsx`**
- In `getButtonForTier`, when `pendingPlan` is set and the tier is the user's current plan (Extended):
  - Show "Cancel Downgrade" button instead of "Current Tier"
- Add `cancelDowngradeLoading` state and `handleCancelDowngrade` function
- Add AlertDialog for cancel-downgrade confirmation

**Modified: `src/components/settings/SubscriptionCard.tsx`**
- Add `cancelDowngradeLoading` state
- When `planData.pending_plan` exists and `cancel_at_period_end` is false, show "Cancel Downgrade" button
- Add confirmation AlertDialog with messaging: "$15/month, charged on your original schedule"
- On confirm, call `cancel-downgrade` function, update local state

