

## Plan: Drop Close Buttons Below the Notch Globally

### Problem
On the native mobile app, the X close button on dialogs sits behind the iPhone Dynamic Island/notch because the absolute positioning (`top-4`) doesn't account for the safe area inset. This affects the campfire dialog, fridge creation dialog, personal profile post lightbox, and any other dialog using the default close button.

### Root Cause
- `dialog.tsx` default close button: `absolute right-4 top-4` — this is relative to the dialog container, but since the container uses `pt-[max(env(safe-area-inset-top),1.5rem)]`, the button overlaps the safe area
- `CampfireDialog.tsx` custom close button: `absolute top-3 right-3` — directly behind the Dynamic Island

### Changes

#### 1. `src/components/ui/dialog.tsx` — Global fix for all dialogs
- Change close button from `top-4` to `top-[max(env(safe-area-inset-top,0px),1rem)]` so it always clears the notch on mobile
- On desktop (`sm:` breakpoint), the safe area inset is 0 so it just uses `1rem` — no visual change

#### 2. `src/components/fridge/CampfireDialog.tsx` — Campfire close button
- Change `top-3 right-3` to `top-[max(env(safe-area-inset-top,0px),0.75rem)] right-3` to clear the Dynamic Island

#### 3. `src/components/ui/sheet.tsx` — Sheet close button
- Change `top-6` to `top-[max(env(safe-area-inset-top,0px),1.5rem)]` for consistency

#### 4. `src/pages/ProfileView.tsx` — Profile post lightbox custom buttons
- The custom Download + X button row needs safe-area top padding: change `pt-2` to `pt-[max(env(safe-area-inset-top,0px),0.5rem)]`

### Files to modify
- `src/components/ui/dialog.tsx` — safe-area-aware close button top position
- `src/components/ui/sheet.tsx` — safe-area-aware close button top position
- `src/components/fridge/CampfireDialog.tsx` — safe-area-aware custom close button
- `src/pages/ProfileView.tsx` — safe-area padding on custom button row

This single global change in `dialog.tsx` fixes every dialog that uses the default close button (fridge creation, albums, events, avatar crop, etc.) without needing per-component fixes.

