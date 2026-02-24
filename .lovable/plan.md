

# Fix: Circle Member Count Not Including the Owner

## Problem
The "Test!" circle for `bbradley@usv.edu` shows 0 members even though that user is the creator/owner. This happens because the member count only queries the `circle_memberships` table, but the circle owner is tracked separately in `circles.owner_id` and is never added to `circle_memberships`.

Some parts of the app (Pricing, SubscriptionCard) already work around this by adding `+1` to the count, but the main Circles page does not.

## Solution
Update `getCircleMemberCount` in `src/lib/circleLimits.ts` to add +1 for the owner. This way, every place that calls this function will automatically include the owner in the count.

## Technical Details

**File: `src/lib/circleLimits.ts`**
- In `getCircleMemberCount`, change the return from `count ?? 0` to `(count ?? 0) + 1` to account for the owner who is always present but not stored in `circle_memberships`.

**File: `src/components/landing/Pricing.tsx`**
- Remove the existing `+1` adjustment since `getCircleMemberCount` will now include it (if it uses `getCircleMemberCount`). Actually, this file queries `circle_memberships` directly with its own inline query and adds `+1` — so no change needed here.

**File: `src/components/settings/SubscriptionCard.tsx`**
- Same as Pricing — uses its own inline query with `+1`, so no change needed.

This is a one-line fix that ensures consistent member counting across the app.
