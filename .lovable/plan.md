

## Plan: Four Mobile UX Fixes

### 1. Move toast notifications below the camera notch
**File:** `src/components/ui/sonner.tsx`
- Increase the `offset` from `16` to `60` so toasts clear the Dynamic Island / camera cutout on iPhones
- Keep the `env(safe-area-inset-top)` style but add additional pixel offset

### 2. Push bell and pin icons to far right on mobile header
**File:** `src/components/layout/CircleHeader.tsx`
- Add `ml-auto` to the mobile fridge+bell container (line ~261) so those two icons are pushed to the far right of the header bar

### 3. Fix missing message input in chat views
**File:** `src/pages/Messages.tsx`
- The DM and group chat overlays use `fixed inset-0 z-50`, but `MobileNavigation` also uses `z-50` and renders later in the DOM, so it covers the message input
- Increase the chat overlay z-index to `z-[60]` (lines 638 and 677) so the full-screen chat properly covers the bottom navigation bar, revealing the message input

### 4. Draft persistence for messages and feed
**Files:** `src/pages/Messages.tsx`, `src/components/feed/CreatePostForm.tsx`
- Store draft text in `sessionStorage` keyed by context (e.g. `draft-dm-{userId}`, `draft-group-{groupId}`, `draft-feed-{circleId}`)
- On mount / conversation switch, restore from sessionStorage
- On text change, save to sessionStorage
- Clear the draft on successful send
- This preserves drafts when navigating away and returning, but clears them when the browser tab is closed

