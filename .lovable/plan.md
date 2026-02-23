

## Fix: Incorrect Member Count and Inflated Member Limit After Transfer Block Claim

### Problem

Two bugs occur when ownership is claimed via the transfer block flow:

1. **Member count drops to 1** -- The `claim_circle_ownership` database function removes the new owner from `circle_memberships`. But the app's member counting (`getCircleMemberCount`) only queries `circle_memberships`. Since the new owner is no longer in that table, they aren't counted. So with 2 people in a circle, only 1 shows.

2. **Member limit inflates to 42** -- The `getCircleMemberLimit` function adds together two sources of "extra members": a per-circle value (`circles.extra_members`, set when purchasing extra member packs) AND a global value (`user_plans.extra_members`, a legacy field). When ownership transfers, the new owner's plan limits apply. If they have an Extended plan (35 base) and any legacy `extra_members` value (e.g., 7), the total becomes 42. These should not be added together.

### Root Cause

The `claim_circle_ownership` (and `transfer_circle_ownership`) database functions follow a pattern where the owner is NOT in `circle_memberships` (implicit owner). But the app's circle creation flow DOES add the owner to `circle_memberships`. This inconsistency causes the count mismatch.

### Solution

**1. Fix `claim_circle_ownership` database function**
- Stop removing the new owner from `circle_memberships` -- they should stay as a member row (matching the creation pattern)
- When adding the old owner, use `ON CONFLICT DO NOTHING` (already there, but the old owner might already be in memberships)

**2. Fix `transfer_circle_ownership` database function**
- Same fix: stop removing the new owner from `circle_memberships`

**3. Fix `getCircleMemberLimit` in `src/lib/circleLimits.ts`**
- Only use `circles.extra_members` (per-circle), NOT `user_plans.extra_members` (global/legacy)
- This prevents the inflated limit of 42

**4. Fix `enforce_circle_member_limit` database trigger function**
- Currently only reads `user_plans.extra_members` (global). Update it to also read `circles.extra_members` and use only the per-circle value for consistency

### Technical Details

**Database migration (2 function updates):**

Update `claim_circle_ownership`:
- Remove the `DELETE FROM circle_memberships WHERE ... user_id = auth.uid()` line
- Keep the old owner insert with `ON CONFLICT DO NOTHING`

Update `transfer_circle_ownership`:
- Remove the `DELETE FROM circle_memberships WHERE ... user_id = _new_owner_id` line

Update `enforce_circle_member_limit`:
- Read `circles.extra_members` for the specific circle
- Use that instead of `user_plans.extra_members`

**Frontend change: `src/lib/circleLimits.ts`**
- In `getCircleMemberLimit`, remove the `user_plans.extra_members` from the calculation
- Only use `circles.extra_members` as the extra member source

These are small, targeted changes that fix both bugs without changing the overall architecture.

