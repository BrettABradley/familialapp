

## Plan: Fix Keyboard-Blocked Forms on Mobile

### Four Issues

1. **Login Page** — Sign In button blocked by keyboard. The card is vertically centered, so when the keyboard opens there's no room to scroll to the button. Fix: shift the card up slightly on mobile by using `justify-start` with modest top padding instead of `justify-center`, so the button remains reachable when the keyboard shrinks the viewport.

2. **Create Event** — Location field is blocked because it sits after the calendar (a tall element). Fix: reorder the form fields so Time and Location come **before** the calendar, right after Description. This way the text inputs the user types into are near the top, and the calendar (which doesn't need the keyboard) is below.

3. **Create Album** — Unnecessary scroll animation when focusing inputs. The form only has 2 fields + a button — everything fits on screen even with the keyboard. Fix: reduce the excessive `pb-48` padding to `pb-4` so the dialog doesn't have extra scrollable space that triggers the jarring movement.

4. **Pin to Fridge** — Form gets blocked by keyboard. Similar to albums, the `ScrollArea` with `max-h-[70vh]` constrains the scrollable area. Fix: add bottom padding (`pb-32`) inside the scroll area so the submit button can be scrolled into view above the keyboard.

### Changes

#### 1. `src/pages/Auth.tsx` (line 181)
- Change `justify-center` to `justify-start pt-[calc(env(safe-area-inset-top,0px)+3rem)]` on mobile, keep `sm:justify-center sm:pt-0` for desktop
- This shifts the card up just enough that the Sign In button clears the keyboard

#### 2. `src/pages/Events.tsx` — Create Event form (lines 672-681) and Edit Event form (lines 736-745)
- Move the Time and Location fields to appear **before** the Calendar in both create and edit forms
- This puts all keyboard-requiring inputs near the top, calendar below

#### 3. `src/pages/Albums.tsx` (line 706)
- Reduce `pb-48` to `pb-4` on the create album form — the form is short enough that massive bottom padding is unnecessary and causes the scroll jump

#### 4. `src/pages/Fridge.tsx` (lines 269, 425-434)
- Add `pb-32` to the inner `div.space-y-4` so the "Pin to Fridge" button can be scrolled past the keyboard

### Files to modify
- `src/pages/Auth.tsx`
- `src/pages/Events.tsx`
- `src/pages/Albums.tsx`
- `src/pages/Fridge.tsx`

