

## Plan: Delete Protection, Transfer Block Read-Only, and Owner Leave

### Overview
Three interconnected changes to how circle deletion and transfer block work:

1. **Delete only when empty** -- The delete button only works if the circle has zero members. If members exist, the dialog redirects the owner to activate transfer block instead.
2. **Transfer block makes circle read-only** -- While a circle is on transfer block, it becomes fully read-only (no posts, messages, pins, events) until someone claims ownership.
3. **Owner can leave after activating transfer block** -- Once transfer block is active, the owner can leave the circle since anyone can claim it.

### What Changes

**Delete Dialog Behavior:**
- When the owner clicks delete, check if there are any members in the circle
- If **no members**: proceed with the existing two-step delete confirmation
- If **members exist**: show a different dialog explaining they can't delete while members are present, with a prominent "Put on Transfer Block" button and an explanation that this lets them step away while someone else claims the circle

**Read-Only During Transfer Block:**
- Update `isCircleReadOnly` in CircleContext to also return `true` when `transfer_block` is `true` on a circle
- This automatically disables all write actions (posts, messages, pins, events) across the app since existing read-only checks already guard those features
- The existing `ReadOnlyBanner` will show, but with transfer-block-specific messaging
- The `TransferBlockBanner` will still show the "Claim Ownership" button

**Owner Can Leave After Transfer Block:**
- In the leave circle flow, if the owner's circle is on transfer block, allow them to leave directly (no need to transfer first since the circle is already up for grabs)
- After leaving, the owner becomes a regular departed user; the transfer block banner remains for the remaining members

**Financial Responsibility on Claim:**
- When someone claims ownership, they immediately become the owner and the circle uses their plan's limits going forward
- The existing capacity indicator (plan name, circles available) already warns potential claimers if they're at capacity before they claim
- No date-based transition needed -- clean handoff on the spot

---

### Technical Details

**File: `src/contexts/CircleContext.tsx`**
- Update `isCircleReadOnly` to add a check: if the circle has `transfer_block === true`, return `true` regardless of plan overflow status

**File: `src/pages/Circles.tsx`**
- Modify `openDeleteDialog`: before opening, count members in the circle. Store the count in state.
- Modify the delete dialog UI:
  - If member count is 0: show existing two-step delete flow
  - If member count > 0: show a new panel explaining "This circle has [N] members. You must remove all members or put the circle on transfer block before deleting." with a "Put on Transfer Block" button
- Modify `handleLeaveCircle`: if the user is the owner AND the circle has `transfer_block === true`, allow them to leave directly (remove them as owner, leave the circle owner-less or handle via the transfer block claim flow)
- For the owner leaving after transfer block: update the `circles` table to keep `transfer_block = true` but we need to handle the "ownerless" state. The simplest approach: the owner stays as `owner_id` in the database (required field) but is removed from active participation. When someone claims, they replace the owner_id. Alternatively, allow the leave to just work as a normal membership removal since the owner is already implicit.

**File: `src/components/circles/ReadOnlyBanner.tsx`**
- Add transfer-block-specific messaging: "This circle is on transfer block and is read-only until someone claims ownership."

**File: `src/components/circles/TransferBlockBanner.tsx`**
- No major changes needed; it already shows the claim button for non-owners

**Database: No schema changes needed**
- The `transfer_block` column and `claim_circle_ownership` RPC already exist
- `isCircleReadOnly` is purely frontend logic

### Edge Cases
- If the owner leaves after transfer block and nobody claims: the circle remains in limbo with transfer_block = true, read-only. The owner_id still points to the departed user. Members can still claim ownership.
- If all members also leave: the circle becomes an empty, ownerless circle. At this point it could be cleaned up by a background job (future enhancement).
- The owner cannot delete while members exist -- they must either remove all members manually first, or use transfer block.

