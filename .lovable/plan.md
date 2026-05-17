## Why images feel slow today

Every `<img>` in Feed, Albums, and the lightbox loads the **full-resolution original** from Supabase Storage (often 3–10 MB HEIC→JPEG conversions from iPhones). There's no:

- `loading="lazy"` / `decoding="async"`
- Width-appropriate resizing (a 4032px photo is rendered into a ~300px grid cell)
- Format negotiation (WebP/AVIF)
- Skeleton/placeholder while loading
- Preload of above-the-fold media

Result: each grid cell downloads megabytes, the main thread blocks decoding huge JPEGs, and iOS WebView feels especially sluggish.

## Fix plan (no business-logic changes)

### 1. Add a Supabase image transform helper
New `src/lib/imageUrl.ts` exporting `transformedImage(url, { width, quality, resize })`. Supabase Storage supports on-the-fly transforms via `?width=&quality=&resize=cover` on the public/signed URL — it returns a smaller, WebP-encoded image and caches it on the CDN. Falls back to the original URL if the URL isn't a Supabase Storage URL (e.g., external avatars).

Presets:
- `thumb` — 400w, q70 (feed grid, album grid, fridge tiles)
- `card` — 800w, q75 (single-image post)
- `full` — 1600w, q80 (lightbox)
- `avatar` — 128w, q75 (all `AvatarImage`)

### 2. New `<SmartImage>` component
`src/components/shared/SmartImage.tsx` — wraps `<img>` and adds:
- `srcSet` with 1x / 2x using the transform helper
- `loading="lazy"` + `decoding="async"` (override-able for LCP)
- `fetchpriority="high"` for the first feed post / album cover
- Width + height attributes (prevents CLS)
- Tiny neutral background while decoding (no layout shift)
- `onError` falls back to the untransformed URL

### 3. Swap raw `<img>` usages
Replace the raw `<img>` tags in:
- `src/components/feed/PostCard.tsx` (grid tiles, single image, lightbox, video thumbs)
- `src/pages/Albums.tsx` (album covers, photo grid, lightbox prev/next)
- `src/components/fridge/FridgeBoard.tsx` (sticker tiles)
- `src/components/profile/*` avatar previews
- `AvatarImage` usages — pass transformed URL via a small `avatarUrl()` helper instead of rewriting the shadcn component

Lightbox prev/next images get **preloaded** via `new Image()` so swiping feels instant.

### 4. Defer offscreen album/feed media
- Feed already paginates; add `loading="lazy"` so scrolled-past pages don't re-decode.
- Album grid: render all tiles but rely on `loading="lazy"` + `content-visibility: auto` on the tile wrapper so iOS skips offscreen work.

### 5. iOS-specific wins
- Add `<link rel="preconnect" href="https://qxkwxolssapayqyfdwqc.supabase.co">` to `index.html` so the TLS handshake to Storage happens before the first image request.
- Keep HEIC client-side conversion (already in place) but **also** downscale on upload to max 2400px long edge in `heicConverter.ts` — current uploads of 4032×3024 are wasteful for a feed that never shows >1600px.

### 6. Verify
- Open Feed on iOS + web, network panel: confirm requests now return WebP and < 200KB per thumbnail.
- LCP image (first feed post) loads in < 1s on a warm cache.
- Album grid of 100 photos: total transferred bytes should drop ~10× (rough target 5–10 MB instead of 50–100 MB).

## Out of scope (can do later if needed)
- Moving to a dedicated image CDN (Cloudflare Images, imgproxy) — Supabase's built-in transformer is good enough for now.
- Blurhash placeholders — nice but adds DB columns; revisit if users still report perceived slowness after the above.

## Files touched
- new: `src/lib/imageUrl.ts`, `src/components/shared/SmartImage.tsx`
- edits: `PostCard.tsx`, `Albums.tsx`, `FridgeBoard.tsx`, `heicConverter.ts`, `index.html`
- no DB migration, no edge function changes, no new secrets