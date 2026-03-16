# Mobile UX Fixes - Batch Plan

## Issues Identified

1. **Auth page**: "Welcome Back" shown to all users including new ones; logo too small
2. **Fridge board**: Pins shifted too far right on mobile
3. **Notifications bell**: Sheet drops from top and gets blocked by camera notch
4. **Feed text input zoom**: iOS auto-zooms on input focus when font-size < 16px
5. **Messages**: Bottom nav shifts above keyboard; message input area not seamless

---

## Changes

### 1. Auth Page (`src/pages/Auth.tsx`)

- Change `"Welcome Back"` to `"Welcome"` for the login title (line 187)
- Change subtitle from "Sign in to connect with your family" to "Sign in or sign up to connect with your family"
- Increase logo from `h-16` to `h-24` (line 184)

### 2. Fridge Board Centering (`src/components/fridge/FridgeBoard.tsx`)

- Adjust `PIN_LAYOUT` left values to center pins better on mobile — shift them slightly left so they don't crowd the right side
- The pin width on mobile is `w-[36%]` with left positions like 6%, 38%, 70% — the 70% one overflows. Reduce to ~62% and rebalance middle positions

### 3. Notifications Bell - Safe Area (`src/components/layout/CircleHeader.tsx`)

- The mobile notification Sheet uses `side="top"`. Add top padding for safe area inset so the notch doesn't cover content: add `pt-[env(safe-area-inset-top)]` to the SheetContent

### 4. Feed Input Zoom Fix (`index.html`)

- Add `maximum-scale=1` to the viewport meta tag to prevent iOS zoom on input focus
- This is the standard fix: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />`

### 5. Messages - Hide Bottom Nav & Fix Input (`src/pages/Messages.tsx` + `src/components/layout/MobileNavigation.tsx`)

- **Hide bottom nav when in a chat**: In `MobileNavigation.tsx`, hide the nav when the current route is `/messages` AND a chat is active. Since MobileNavigation doesn't know chat state, instead: hide the bottom nav entirely on the Messages page when in chat view by conditionally hiding it via a CSS approach or route-based check.
- Simpler approach: In `Messages.tsx`, when `chatView === "dm"` or `chatView === "group"`, render the chat as a full-screen overlay that covers the bottom nav. Remove the `pb-16` padding and use `fixed inset-0` positioning with proper safe area handling for the input bar at the bottom.
- The message input should be `fixed bottom-0` with `pb-[env(safe-area-inset-bottom)]`, similar to how Instagram/iMessage handles it — the input sticks to the bottom and the keyboard pushes it up naturally via the viewport resize.
- Remove `h-[calc(100vh-140px)]` and `pb-16 md:pb-0` from chat containers. Instead use a flex column layout with `fixed inset-0` that accounts for the header.

### Implementation Detail for Messages Chat View

- Wrap DM and Group chat views in a `fixed inset-0 z-50 bg-background` container so it overlays everything including the bottom nav
- Structure: fixed container → header bar (with back button) → scrollable messages area (flex-1 overflow-y-auto) → input bar at bottom with safe area padding
- This eliminates the need to hide MobileNavigation and prevents the keyboard from pushing the nav bar up

---

## Files to Modify

1. `index.html` — viewport meta tag
2. `src/pages/Auth.tsx` — logo size, title text
3. `src/components/fridge/FridgeBoard.tsx` — pin layout positions
4. `src/components/layout/CircleHeader.tsx` — notification sheet safe area
5. `src/pages/Messages.tsx` — full-screen chat overlay pattern