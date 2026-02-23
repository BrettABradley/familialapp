

## Remove Transfer Ownership, Keep Only Transfer Block

### What Changes

The current code has two ways to hand off a circle:
1. **Transfer Ownership** -- owner picks a specific member, sends a request, they accept/deny (uses `circle_transfer_requests` table and `transfer_circle_ownership` database function)
2. **Transfer Block** -- owner puts the circle on transfer block, any member can claim it (uses `claim_circle_ownership` database function)

We're removing option 1 entirely and keeping only Transfer Block. This simplifies the flow: if an owner wants to leave or hand off, they put the circle on transfer block.

### Changes by File

**1. `src/pages/Circles.tsx`**
- Remove the `isTransferOpen` state and the Transfer Ownership dialog (lines 897-941)
- Remove the `isLeaveTransferOpen` state and the "Transfer & Leave" dialog (lines 943-992)
- Remove the `handleTransferOwnership` function
- Remove the `handleTransferAndLeave` function
- Remove the `memberPlans` state and the logic that fetches member plan info (only used for showing plan capacity in transfer dialogs)
- Remove the "Transfer Ownership" button from the members dialog
- Remove `ArrowRightLeft` from the icon imports
- Update the owner leave flow: instead of opening a "Transfer & Leave" dialog, directly call `handleTransferBlock` so the owner puts the circle on transfer block, then can leave

**2. `src/pages/Notifications.tsx`**
- Remove `handleAcceptTransfer` and `handleDenyTransfer` functions
- Remove the Accept/Deny buttons for `transfer_request` notifications in the notification list
- Remove the `transfer_request` case from the notification icon switch (or keep it harmlessly -- old notifications may still exist)
- Remove the `respondingTo` state

**3. `src/components/circles/ReadOnlyBanner.tsx`**
- Update the non-owner text from "The owner needs to upgrade, transfer ownership, or delete this circle..." to "The owner needs to upgrade or delete this circle to restore full access."

**4. Database migration**
- Drop the `transfer_circle_ownership` function (no longer needed; `claim_circle_ownership` stays)
- The `circle_transfer_requests` table can remain in the database (old data) but will no longer be used by the app. No migration needed to drop it -- it's harmless.

### Owner Leave Flow (After Changes)

When an owner tries to leave a circle with other members:
- If transfer block is already active: leave directly (existing behavior, unchanged)
- If transfer block is NOT active: prompt them to put the circle on transfer block first, then they can leave

This is simpler and more consistent than the current two-path approach.

### Technical Details

**`src/pages/Circles.tsx` state cleanup:**
- Remove: `isTransferOpen`, `isTransferring`, `isLeaveTransferOpen`, `memberPlans`
- Keep: `isTransferring` can be removed since it's only used by the removed transfer functions

**`src/pages/Circles.tsx` leave flow update (lines 510-515):**
Replace opening the leave-transfer dialog with directly calling `handleTransferBlock(circle)` so the owner activates transfer block. After that, they can leave via the existing transfer-block leave path.

**`src/pages/Notifications.tsx` cleanup:**
Remove ~100 lines of transfer request handling code. Old `transfer_request` notifications will still render (title/message) but without Accept/Deny buttons.

**Database migration:**
```sql
DROP FUNCTION IF EXISTS transfer_circle_ownership(uuid, uuid);
```

