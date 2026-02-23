
## Fix: Allow cancellation to Free even when a downgrade is pending

### Problem
When a user has a pending downgrade (e.g., Extended to Family), the Free tier button incorrectly shows "Cancel Pending" (disabled). The user should still be able to cancel their membership entirely, even while a tier-to-tier downgrade is pending.

### Root Cause
The condition at line 441 checks `cancelAtPeriodEnd && tierPlan === "free"` without considering whether the cancellation is a standalone action or part of a tier downgrade. When `pendingPlan` is set (meaning a tier-to-tier downgrade, not a full cancellation), Free should remain actionable.

### Fix (single file change)

**File: `src/components/landing/Pricing.tsx`**

Update the Free tier logic (lines 440-447) so that "Cancel Pending" only appears when there's a standalone cancellation (i.e., `cancelAtPeriodEnd` is true but `pendingPlan` is NOT set). When a tier-to-tier downgrade is pending, Free remains clickable with "Cancel Membership":

```text
Before:
  - pendingPlan = "family" + cancelAtPeriodEnd = true --> Free shows "Cancel Pending" (WRONG)

After:
  - pendingPlan = "family" (tier downgrade) --> Free shows "Cancel Membership" (clickable)
  - cancelAtPeriodEnd = true, no pendingPlan (full cancel) --> Free shows "Cancel Pending" (disabled)
```

The condition changes from:
```typescript
if (cancelAtPeriodEnd && tierPlan === "free")
```
to:
```typescript
if (cancelAtPeriodEnd && !pendingPlan && tierPlan === "free")
```

This single condition change ensures users can always navigate to a lower tier, even when another change is already pending. The existing `handleConfirmDowngrade` function already handles the Stripe and database updates correctly for cancellations.
