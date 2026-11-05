# Faster photos, videos and tab switching

## What's slowing things down today
- Every photo needs its own private "permission link" fetched from the server one at a time, and each request re-checks the login first. A feed with 20 photos means 20+ round trips before images can start.
- Those links are only remembered in memory, so closing/reopening the app or refreshing the website starts from zero.
- Each tab (Feed, Albums, Events, Messages, Fridge) reloads its data from scratch whenever you switch to it, showing a spinner instead of what you just saw.
- Videos have no poster frame ready up front and begin downloading only when played.

## The plan

1. **Batch photo links** — request permission links for a whole screen of photos in one server call instead of one per photo, and check the login once per batch instead of per photo.
2. **Remember links across launches** — save links (valid 1 hour) on the device so reopening the app or website shows photos instantly; refresh them quietly in the background before they expire. Extend link lifetime to 6 hours to cut refreshes.
3. **Right-sized images everywhere** — make sure grids/thumbnails always use the small version (400px), single posts the medium (800px), and only the full-screen viewer loads the large one. Add blurred placeholders with fixed sizes so the page doesn't jump while loading.
4. **Load what's next before you need it** — prefetch the next few posts' photos while scrolling, and preload the large version when you tap into a photo.
5. **Instant tab switching** — keep each tab's last-loaded data in memory (and on device) so switching tabs shows content immediately, then updates in the background. Keep recently visited screens mounted instead of rebuilding them.
6. **Faster first open** — load rarely used pages (Admin, Pitch, Blog, legal pages, Store) only when visited, so the main app opens quicker.
7. **Videos** — show a poster image immediately, preload just the first few seconds of videos that scroll into view, and keep full download until play.

## How we'll check it
- Measure feed load and tab switch time before and after in the browser on a slow mobile connection, and confirm photos appear without blank boxes.
- Confirm nothing changes about who can see what — links stay private and expire.

## Technical details
- `src/lib/postMediaUrl.ts`: use `createSignedUrls` (batched) with a micro-queue that collects requests for ~16ms; single `getSession()` per batch; persist cache to localStorage (keyed by bucket|path|transform, pruned on expiry); TTL 6h.
- Audit `imageUrl.ts` preset usage across PostCard, Albums, Fridge, avatars; add width/height + `fetchpriority="high"` on first feed image, lazy elsewhere.
- Move Feed/Albums/Events/Fridge/Notifications fetches to React Query with `staleTime` ~60s, `gcTime` 30min, and `@tanstack/query-sync-storage-persister` for device persistence; invalidate on realtime events/posts as today.
- `App.tsx`: `React.lazy` for non-core routes inside one `Suspense`; core tabs stay eager.
- Videos: `preload="metadata"`, IntersectionObserver to switch near-viewport videos to `preload="auto"` for the next one only.
- Applies to both web and the mobile app (same code); no new store build required for most of it, but mobile users get it in the next iOS/Android build.
