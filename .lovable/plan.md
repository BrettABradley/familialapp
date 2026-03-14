

## Fix: iOS Safe Area Insets

The header is overlapping the iPhone status bar/notch because the app isn't respecting iOS safe area insets. This is a standard Capacitor issue — the web content renders behind the system UI (clock, battery, signal bars).

### Changes

**1. `index.html`** — Already has `viewport-fit=cover` (good). No changes needed.

**2. `src/index.css`** — Add safe area padding utilities:
- Add `padding-top: env(safe-area-inset-top)` to the body or root element
- This pushes content below the iOS status bar

**3. `src/components/layout/CircleHeader.tsx`** — Add top safe area padding to the sticky header:
- Change `top-0` to include `pt-[env(safe-area-inset-top)]` so the header sits below the notch/status bar

**4. `src/components/layout/MobileNavigation.tsx`** — Already uses `pb-safe` (good), but verify it works with the safe area inset for the bottom home indicator.

### How it works

iOS provides `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` CSS environment variables that report the exact pixel height of the status bar and home indicator. By adding these as padding to the header and bottom nav, the app content stays within the visible area.

This is purely a CSS change — no logic changes needed. The fix only activates on devices with notches/status bars; on web browsers these values are 0.

