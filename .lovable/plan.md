

## Fix: Chat header overlapping with Dynamic Island / status bar

### Problem
From the screenshot, the chat header (back arrow + avatar + name) is rendering **behind** the Dynamic Island / status bar area. The inline style `paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)'` is on the header div itself, but the `fixed inset-0` container starts at the very top of the screen — so the header content gets pushed into the notch area.

### Root Cause
The safe-area padding is applied to the header `div`, but `0.5rem` (8px) added to the safe area inset isn't enough clearance. The Dynamic Island on newer iPhones needs more breathing room. Increasing to `1rem` (16px) will push the header content fully below the notch.

### Fix (src/pages/Messages.tsx)

**DM header (line 702)** and **Group header (line 742):**
- Change `paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)'` → `paddingTop: 'calc(env(safe-area-inset-top) + 1rem)'`

This gives the header enough clearance below the Dynamic Island so the back arrow and contact name are always fully visible and tappable.

### Files to modify
- `src/pages/Messages.tsx` — two lines (702 and 742)

