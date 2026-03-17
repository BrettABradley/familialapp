

## Plan: Fix Transfer Block bugs, Double Notification Header, Add Support Page, and Apple Store Copy

### Issue 1: "Create Your First Circle" showing incorrectly on Feed
**Root cause**: In `src/pages/Feed.tsx` line 104, the condition is `circles.length > 0 && !readOnly`. When a circle is on transfer block, `readOnly` is `true`, so it falls into the `else` branch showing "Create Your First Circle" — even though circles exist.

**Fix**: Change the condition to separate the two concerns:
- If `circles.length === 0` → show "Create Your First Circle"
- If `circles.length > 0 && readOnly` → show the feed area but hide the CreatePostForm
- If `circles.length > 0 && !readOnly` → show CreatePostForm normally

### Issue 2: Double "Notifications" header in mobile sheet
**Root cause**: The mobile notification sheet has a `SheetHeader` with `SheetTitle` saying "Notifications" AND `notifContent` also renders its own "Notifications" header div (line 123-124 of CircleHeader.tsx). Both render, causing the duplicate.

**Fix**: Remove the "Notifications" title span from `notifContent` when rendered inside the mobile sheet. Simplest approach: remove the header row from `notifContent` and instead put the "Mark read" / "Clear all" buttons into the `SheetHeader` for mobile, keeping the existing `notifContent` header only for the desktop Popover.

### Issue 3: Claim ownership not working on mobile
**Root cause**: The `TransferBlockBanner` component calls `supabase.rpc("claim_circle_ownership" as any, ...)`. The RPC function exists and looks correct. The issue is likely that after claiming, `refetchCircles()` is called but the component may unmount or the banner may not reflect the change. Need to check if the RPC call itself errors silently. Will add better error logging and ensure the `as any` cast isn't hiding a type mismatch. Also, the banner shows the "Claim Ownership" button but the user may be the owner — need to verify the owner check works when transfer_block is true.

**Fix**: 
- Remove the `as any` cast since `claim_circle_ownership` IS in the types 
- Add proper error handling/toast for all failure cases
- Ensure refetchCircles properly updates state after claim

### Issue 4: Support page
**What to build**: A new `/support` page linked from the landing header with:
- Platform features overview (Circles, Feed, Events, Albums, Messages, Fridge)
- Basic how-to guides for each feature
- Contact information (support@familialmedia.com, (480) 648-9596)
- FAQ-style layout

**Files**:
- Create `src/pages/Support.tsx`
- Update `src/components/landing/Header.tsx` — change "Contact Support" mailto link to `/support` route
- Update `src/App.tsx` — add `/support` route

### Issue 5: Apple Store promotional text
Will provide recommended copy for:
- Promotional Text (170 chars)
- Description (4000 chars)
- Keywords (100 chars)
- Subtitle (30 chars)

---

### Files to modify
- `src/pages/Feed.tsx` — Fix the readOnly/circles conditional logic
- `src/components/layout/CircleHeader.tsx` — Remove duplicate Notifications header from mobile sheet
- `src/components/circles/TransferBlockBanner.tsx` — Fix RPC call, remove `as any`
- `src/components/landing/Header.tsx` — Link "Contact Support" to `/support`
- `src/App.tsx` — Add `/support` route
- Create `src/pages/Support.tsx` — New support/help page

### Apple Store Copy (delivered in implementation message)
- Subtitle: "Your Family's Private Space"
- Promotional Text: Highlights privacy-first, no algorithms, no ads
- Description: Full feature breakdown, plan tiers, privacy commitment
- Keywords: family app, private social network, family photos, family events, no ads

