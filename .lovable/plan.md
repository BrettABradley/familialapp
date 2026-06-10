## Plan — Harden Album Circle Lock

Focus only on the album lock. The current code hides the header's circle dropdown when an album is open, but it does NOT block circle changes from other paths, so the active circle can still flip mid-album.

### Root cause
`setLockCircleSwitcher(true)` in `src/pages/Albums.tsx` only affects the visible `<Select>` in `CircleHeader`. These paths can still change `selectedCircle` while an album is open:

1. **Deep-link sync** — `src/hooks/useDeepLinkCircleSync.ts` calls `setSelectedCircle(target)` whenever a notification deep-link arrives with `?circle=ID`. Runs even while inside an album.
2. **URL `?circle=` param** — `Albums.tsx` itself runs `setSelectedCircle(circleIdParam)` on every change of `circles`/`circleIdParam`, which can re-fire after the album is open.
3. **Any future caller** of `setSelectedCircle` from elsewhere (header sheet, push handler, etc.) bypasses the lock entirely because the lock is UI-only.

### What I'll change

1. **`src/contexts/CircleContext.tsx`** — Make the lock authoritative:
   - Hold `lockCircleSwitcher` in a ref alongside the state so the latest value is readable inside the setter without stale-closure issues.
   - In `setSelectedCircle`, if the lock is active AND the requested circle differs from the current `selectedCircle`, ignore the call (log a warning, do not write to localStorage). Always allow setting the same circle (no-op) and allow clearing on sign-out.
   - Expose a small internal escape hatch only used by the album page itself (e.g. an `unsafeSetSelectedCircle` or a "force" arg) so the album page can still apply the initial deep-linked `?circle=` BEFORE it locks. No other caller will use it.

2. **`src/pages/Albums.tsx`** — Tighten interaction with the lock:
   - When opening an album from the list (user tap), call `setLockCircleSwitcher(true)` synchronously in the same handler that sets `selectedAlbum`, so there's no render gap.
   - Keep the existing cleanup that releases the lock when `selectedAlbum` becomes null or the page unmounts.
   - For the `?circle=` deep-link effect, use the new force path so it can sync circle once before locking, but never after.

3. **`src/hooks/useDeepLinkCircleSync.ts`** — Defensive: check `lockCircleSwitcher` from context and skip switching while it's true. (Redundant with #1, but avoids spurious warnings and keeps intent clear.)

4. **Verify**
   - Re-grep all callers of `setSelectedCircle` to confirm none try to switch circles while a lock is active in a way that would surprise users.
   - Walk through three scenarios mentally and confirm the lock holds:
     a) Open album → tap a push notification for a different circle → stays on current album's circle.
     b) Open album via `/albums?circle=A&album=X` → URL sync sets circle A, then lock engages, no further switches.
     c) Close album (back button or selecting another album list) → lock releases cleanly.

### Out of scope
- Splash / dark mode work (untouched per your instruction).
- Native config changes.
- Any visual change to the header beyond what's already there.