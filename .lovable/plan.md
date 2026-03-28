

# Fix Upgrade Button UI, Circle Limit Logic, Extra Members, and Profile Cleanup

## Summary

1. **Upgrade button on Circles page**: Change from "Upgrade" text + icon to just the ArrowUp icon. Grey it out when user is on Extended (highest tier). Re-enable if they downgrade.

2. **Create Circle button**: Grey out when `circleCount >= circleLimit`. This already dynamically updates since `circleCount` and `circleLimit` are re-fetched when `circles` changes, so deleting a circle will automatically un-grey it.

3. **Remove ArrowUp upgrade button from ProfileView**: Remove the upgrade icon button next to settings on the profile page.

4. **Fix extra members not being applied to the circle**: The issue is a **race condition** — both `verify-checkout` and `stripe-webhook` try to add extra members. The `verify-checkout` runs first (client calls it immediately after redirect), adds +7 to the circle. Then the webhook fires and also adds +7, resulting in +14 for one purchase. OR the opposite: the webhook fires but the `verify-checkout` also runs and they conflict. **The real fix**: Make `verify-checkout` NOT update extra members — let the webhook handle it authoritatively. The `verify-checkout` should just check the session status and return the result type without modifying the database for extra members.

   Wait — actually looking more carefully, the problem might be the **opposite**: the webhook's RLS update on `circles` table fails because the webhook uses service role but the `restrict_circle_member_update` trigger checks `auth.uid()` which is NULL for service role calls. Let me re-check... The trigger function `restrict_circle_member_update` checks `OLD.owner_id = auth.uid()` — for service role, `auth.uid()` is NULL, so ownership check fails, and the trigger would raise an exception since `extra_members` is being changed by a non-owner.

   **This is the bug.** The trigger blocks the webhook from updating `extra_members` because `auth.uid()` is NULL when using service role. The `verify-checkout` also uses service role, so it has the same problem.

   **Fix**: Update the `restrict_circle_member_update` trigger to allow updates when called via service role (i.e., when `auth.uid()` IS NULL, skip the restriction since it's a server-side operation).

5. **Fix past purchases**: Run the `sync-stripe-purchases` function after the trigger fix to retroactively apply extra members for past purchases.

## Technical Details

### Files to Modify

**`src/pages/Circles.tsx`**:
- Line 772: Add `disabled` and opacity styling to Create Circle button when `circleCount >= circleLimit`
- Lines 791-793: Change Upgrade button from `<ArrowUp + "Upgrade">` to just `<ArrowUp>` icon-only button, with `size="icon"`. Add disabled state when user plan is "extended" or "founder". Need to fetch user plan — can reuse `user_plans` query.

**`src/pages/ProfileView.tsx`**:
- Lines 321-323: Remove the ArrowUp upgrade button entirely from the profile header.

**Database migration**:
- Update `restrict_circle_member_update` trigger function to skip restrictions when `auth.uid() IS NULL` (service role context).

### Implementation Notes

- For the Circles page, we need the user's current plan to grey out the upgrade button. We can fetch it from `user_plans` alongside the existing `circleCount`/`circleLimit` queries.
- The Create Circle button disabling is straightforward: `disabled={circleCount >= circleLimit}` with reduced opacity.
- The trigger fix is critical — without it, no extra member purchase actually works via webhook or verify-checkout.

