## Problem

After rotating to landscape and back to portrait, the bottom mobile nav disappears. CSS rule `.keyboard-open .keyboard-hide { display: none }` is hiding it, which means `.keyboard-open` is stuck on `<html>` even though no keyboard is showing.

We already added a self-correcting safety net in `src/lib/capacitorInit.ts` (orientationchange + visualViewport resize listeners that clear `.keyboard-open` when the viewport is back to ~full height). The user is still hitting the bug, so that net isn't catching every case.

## Why the current fix can miss

1. **Listeners live inside the Keyboard `try` block.** If `@capacitor/keyboard` import is slow or fails on that launch, the safety net is never registered.
2. **`orientationchange` is unreliable on iOS WebView.** The modern `screen.orientation.change` event fires more consistently.
3. **No fallback if visualViewport never resizes back.** On some iOS rotations the visualViewport `resize` event fires while the WebView is still mid-rotation, so the measurement misses by more than the 100px tolerance and the class is never cleared.

## Fix

Edit only `src/lib/capacitorInit.ts`:

1. **Move the `clearIfKeyboardGone` helper and its listeners OUT of the Keyboard try/catch** so they always register, even if the Capacitor Keyboard plugin fails to load.
2. **Add `screen.orientation.addEventListener('change', ...)`** alongside the existing `orientationchange` listener (both, for older/newer iOS).
3. **Add a third deferred check at ~1500ms** after rotation, since the visualViewport sometimes settles late on iOS.
4. **Loosen the tolerance to 150px** to handle iOS URL-bar/safe-area discrepancies after rotation.
5. **Add a `pageshow` / `visibilitychange` check** so returning to the app after backgrounding also runs the cleanup — covers the case where the user rotates while the app is briefly suspended.

No CSS changes. No changes to `MobileNavigation.tsx`. The `.keyboard-open` class is still only ADDED by `keyboardWillShow` — we just make REMOVAL more aggressive.

## Out of scope

- Not touching `.keyboard-hide` on the nav (intentional behavior when keyboard is up).
- Not changing `useIsMobile` or any layout component.
- Not changing `index.css`.

## Risk

Very low. The new logic only removes a class when it can confirm the keyboard isn't present. Worst case: `.keyboard-open` is cleared one frame earlier than today in some edge case, which would briefly show the nav while the keyboard is dismissing — acceptable.
