

## Plan: Add claim action to transfer block banner on mobile

### Problem
When a circle is on transfer block, two banners show: the red `TransferBlockBanner` (from AppLayout) with a claim button (for non-owners), and the yellow `ReadOnlyBanner` (from Feed) without any action. The yellow banner is redundant and lacks a claim link. For non-owners, the claim button exists in the red banner but may not be prominent enough.

### Changes

**1. `src/components/circles/ReadOnlyBanner.tsx`**
- When `isTransferBlock` is true AND the user is NOT the owner, add a "Claim Ownership" button that triggers the claim flow directly, or show a clear call-to-action that scrolls up to the red banner.
- Simpler approach: when `isTransferBlock` is true, skip rendering entirely since `TransferBlockBanner` already handles it in the layout. This removes the duplicate.

**2. `src/components/circles/TransferBlockBanner.tsx`**
- For non-owners: ensure the claim button is always visible and prominent (it already exists but let's verify it renders correctly on mobile).
- Add a session refresh (`supabase.auth.getSession()`) before the RPC call to prevent stale auth failures on mobile.
- Remove the `(circle as any).transfer_block` cast — circle type already includes `transfer_block`.

### Files to modify
- `src/components/circles/ReadOnlyBanner.tsx` — skip rendering when transfer_block is true (TransferBlockBanner handles it)
- `src/components/circles/TransferBlockBanner.tsx` — add auth session refresh before RPC, remove `as any` cast, ensure claim button layout works on mobile

