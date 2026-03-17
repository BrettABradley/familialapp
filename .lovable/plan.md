

## Fix: Chat header needs more clearance below the Dynamic Island

### Problem
From the screenshot, the back arrow and contact name are sitting at the same level as the clock/status bar text, meaning the safe-area padding on the header wrapper isn't providing enough clearance. The content row needs a guaranteed minimum top offset so it always sits below the Dynamic Island, even when the keyboard is open.

### Root cause
The current approach uses `paddingTop: 'env(safe-area-inset-top, 0px)'` on the outer wrapper, but this value alone isn't reliably clearing the Dynamic Island pill. The content row starts immediately after that padding, which on some devices still overlaps.

### Changes

#### `src/pages/Messages.tsx`
For both the DM header (line 702) and Group header (line 744):

- Change the outer wrapper's `paddingTop` to use a `max()` with a generous minimum fallback:
  ```
  paddingTop: 'max(env(safe-area-inset-top, 0px), 3.25rem)'
  ```
  This ensures at least 52px of top spacing even if `env()` returns 0 or a small value.

- Keep the inner content row (`min-h-[3.5rem]`) unchanged so the back button and name have proper tap targets.

This two-layer approach means:
1. The outer wrapper pushes content below the Dynamic Island (at least 52px)
2. The inner row provides the actual header content with proper height
3. The header remains `flex-shrink-0` and sticky at the top of the fixed overlay, so it stays visible and tappable even when the keyboard is open

### Files to modify
- `src/pages/Messages.tsx` (2 lines)

