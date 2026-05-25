
## Bug

After rotating iOS landscape → portrait, the bottom mobile nav disappears.

## Root cause

`src/components/layout/MobileNavigation.tsx` has the class `keyboard-hide`. In `src/index.css`:

```css
.keyboard-open .keyboard-hide { display: none !important; }
```

`.keyboard-open` is added on `<html>` by the `keyboardWillShow` Capacitor listener in `src/lib/capacitorInit.ts`, and removed only by `keyboardWillHide`. On iOS, rotation events can fire `keyboardWillShow` without a matching `keyboardWillHide` (Apple bug, well documented), so the class gets stuck and the nav stays hidden permanently.

## Fix

Make `keyboard-open` self-correcting: clear it whenever there's no real keyboard present.

### File: `src/lib/capacitorInit.ts`

Add **inside** the existing `try { const { Keyboard } = await import('@capacitor/keyboard') ... }` block, after the two existing listeners:

1. **`screenOrientation` `change` listener** on `window` — wait 300ms (let iOS settle), then if `window.visualViewport.height >= window.innerHeight - 100`, force-clear:
   - remove `.keyboard-open` class from `documentElement`
   - reset `--keyboard-height` to `0px`
   - reset `--visual-viewport-height` to `window.innerHeight`

2. **`visualViewport` `resize` listener** — same self-correction. If the visual viewport returns to roughly the full window height, the keyboard is gone regardless of whether the Capacitor listener fired. This catches the rotation case AND any other edge case where `keyboardWillHide` never arrives.

Keep both — orientation is the primary trigger but visualViewport is the belt-and-suspenders catch.

### Why this is safe

- It only **removes** the stuck class; it never adds one. The existing `keyboardWillShow` is still the only thing that sets `keyboard-open`, so the keyboard-hide behaviour for messaging / chat input is unaffected.
- The 100px tolerance handles iOS's small URL-bar / safe-area discrepancies on the visual viewport.
- Pure addition — no existing logic changes.

## Out of scope

- Not touching `useIsMobile` (works correctly).
- Not removing `.keyboard-hide` from the nav — hiding the nav while the keyboard is up is intentional behaviour.
