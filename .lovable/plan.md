
## Fix: Cancellation should override a pending downgrade

### Problem
When a user cancels their membership to Free while a downgrade (Extended to Family) is pending:
1. The `cancel-subscription` backend function does NOT clear `pending_plan` in the database
2. The frontend does NOT clear `pendingPlan` in local state
3. On page refresh, the UI reads `pending_plan: "family"` from the database and shows "Current Tier" / "Downgrade Pending" instead of showing a cancellation is scheduled

### Root Cause
The `cancel-subscription` edge function only updates `cancel_at_period_end` and `current_period_end` but leaves `pending_plan` untouched. Since the UI checks `pendingPlan` first, it never reaches the cancellation display logic.

### Fix (2 files)

**1. Backend: `supabase/functions/cancel-subscription/index.ts`**
- Add `pending_plan: null` to the database update so any pending tier-to-tier downgrade is cleared when the user chooses a full cancellation instead

**2. Frontend: `src/components/landing/Pricing.tsx`**
- In `handleCancelConfirm` (the "cancel to free" branch around line 312), add `setPendingPlan(null)` after a successful cancellation so the UI immediately reflects the correct state without needing a page refresh

### Result
- Canceling to Free clears any pending downgrade in both Stripe-side state and the database
- The UI immediately shows "Cancel Pending" on the Free tier and "Cancel Downgrade" on the current tier
- On page refresh, the database correctly has `pending_plan: null` and `cancel_at_period_end: true`, so the cancellation state displays properly
