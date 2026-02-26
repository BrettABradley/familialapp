

## Plan: Hidden invite code with reveal, copy, and refresh buttons

### Changes

#### 1. Add state for invite code visibility (`src/pages/Circles.tsx`)
- Add `visibleCodeId` state to track which circle's invite code is currently revealed (null = all hidden)
- Add `refreshingCodeId` state for loading feedback during refresh

#### 2. Update invite code display (lines 803-819)
- Replace the always-visible `<code>` element with masked dots (`••••••••`) by default
- Add an Eye/EyeOff toggle button to show/hide the code
- Keep the existing Copy button (only copies when revealed, or copies regardless)
- Add a RefreshCw button that calls Supabase to generate a new invite code

#### 3. Add `handleRefreshInviteCode` function
- Generate a new 8-char code client-side (or use a simple random string)
- Update the circle's `invite_code` in the database
- Refetch circles to reflect the change
- Show a toast confirmation

### Files to modify
- `src/pages/Circles.tsx` — add visibility toggle, refresh button, and handler

