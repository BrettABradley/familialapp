## Problem

After portrait → landscape → portrait, the bottom nav (`.keyboard-hide`) is still hidden, meaning `.keyboard-open` is stuck on `<html>`.

The previous fix added rotation listeners that call `clearIfKeyboardGone`, but that helper only removes the class **if `visualViewport.height >= window.innerHeight - 150`**. On iOS after a double-rotation, `visualViewport.height` can momentarily report a stale/smaller value (mid-rotation reflow), so all three polls (300/800/1500ms) can still fail the threshold and the class never gets cleared.

The viewport-height heuristic is the wrong guard for the rotation case. A keyboard cannot be visible without a focused input/textarea — so when nothing is focused, the class should be removed unconditionally.

## Fix

Edit only `src/lib/capacitorInit.ts`:

1. **Add a `forceClearKeyboardState()` helper** that removes `.keyboard-open` and resets the CSS vars without any viewport check.
2. **In `scheduleRotationCleanup`**, at each poll tick, check `document.activeElement`. If it isn't an `INPUT`, `TEXTAREA`, or `[contenteditable]`, call `forceClearKeyboardState()` instead of the heuristic. If something is focused, fall back to `clearIfKeyboardGone` (keep current behavior).
3. **Apply the same focus-check** to the `pageshow` and `visibilitychange` handlers.
4. **Add one final safety tick at ~2500ms** for very slow iOS rotations.
5. Keep `keyboardWillShow` / `keyboardWillHide` exactly as-is — they remain the only path that *adds* the class.

## Why this works

The keyboard physically cannot be open if no editable element has focus. Rotation almost never preserves keyboard focus across orientation flips on iOS. So on rotation, the focus check will almost always be false → unconditional clear → nav reappears, no matter what the viewport heuristic says.

## Out of scope

- No CSS changes
- No changes to `MobileNavigation`, `useVisualViewport`, or any layout
- The `.keyboard-open` class is still only added by `keyboardWillShow`

## Risk

Very low. The unconditional clear only runs when no input is focused, so it can't hide a legitimately-open keyboard's state.
