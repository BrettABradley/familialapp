# Hide splash overlay on web

The 2.5s white splash overlay is only meant for native iOS/Android cold launches. On the web it's just an unnecessary delay before the landing page paints.

## Change

**`src/main.tsx`** — wrap the splash overlay logic in a `Capacitor.isNativePlatform()` check. On web, immediately remove the `#splash` element on first paint (no hold, no fade). On native, keep the existing 2.5s hold + 700ms fade.

That's it — `index.html` still ships the overlay markup (needed so native sees white from the very first frame), but JS removes it instantly on web.

## File touched
- `src/main.tsx`
