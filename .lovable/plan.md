## Root cause

Two separate pain points the user is feeling:

1. **Layout jump in Feed.** Single-image posts wrap `SmartImage` in a container with `h-auto max-h-[600px]` — no reserved height. The post card collapses to text/buttons, then the image decodes and shoves everything down. Multi-image carousels are already `aspect-square` so they're fine, but the inner image still pops in without a skeleton.
2. **Images feel slow.** Even though signed URLs already include the `card` transform (~800px WebP), three things still hurt:
   - Carousel tiles render at the screen width on phones (~390px) but request the 800px variant — ~4× more bytes than needed.
   - No `srcset`, so retina screens always pull 1×.
   - No progressive low-res placeholder on Feed/Messages/Fridge tiles (only the Album lightbox uses `lowPreset="thumb"`).
   - Off-screen posts aren't pre-signed/pre-decoded, so each one waits on a network round-trip the first time it scrolls into view.

## Changes

### 1. `SignedSmartImage` — srcset, skeleton, fade-in

`src/components/shared/SignedSmartImage.tsx`

- Sign a second URL at `width × 2` for retina and emit `srcSet="<1x> 1x, <2x> 2x"`.
- Add a `reserveAspect?: number` prop. When set, wrap the `<img>` in a `style={{ aspectRatio: reserveAspect }}` div that shows the animated `Skeleton` until `onLoad` fires, then fades the image in.
- Keep the existing `lowPreset` progressive-blur behavior; it composes with the skeleton.

### 2. `SquareSignedThumbnail` — drop preset to `thumb` for carousel tiles

`src/components/shared/SquareSignedThumbnail.tsx`

- Default `preset` stays `thumb` (already 400px).
- Pass `lowPreset="thumb"` through (no-op when same preset — guarded inside the component) and wire a skeleton overlay via the new `reserveAspect={1}`.

### 3. `PostCard` — reserve aspect ratio for every media tile

`src/components/feed/PostCard.tsx`

- `MediaItem` single-image branch: wrap in a container with a default `aspectRatio: 4/5` placeholder + skeleton. After the image's `onLoad`, swap to its natural `naturalWidth/naturalHeight` ratio (tracked in local state) so tall photos still show full. Use `SignedSmartImage path={…} preset="card" lowPreset="thumb"` instead of `SmartImage`.
- `PostMediaCarousel`: switch `FeedImagePreview` to `preset="thumb"` (carousel tiles never exceed ~500px wide); keep `aspect-square` reservation; add `lowPreset` so first paint is the cached thumb.
- Drop the redundant `useSignedMediaUrls(imagePathsForCard, PRESET_TRANSFORM.card)` pre-sign for rendering (the new `SignedSmartImage` does it). Keep `fullUrls` only for the lightbox and download handler.

### 4. Feed skeleton reserves image space

`src/pages/Feed.tsx`

- Update the initial-load skeleton card to include a `<div className="aspect-square w-full" />` Skeleton block under the text Skeletons so the loading state matches the real card shape and there's no jump between skeleton → first post.

### 5. Viewport prefetch for upcoming posts

`src/components/feed/PostCard.tsx` + `src/lib/postMediaUrl.ts`

- Add `prefetchSignedMediaUrl(path, transform)` — fires `getPostMediaUrl` and a hidden `Image()` decode in the background, populating the in-memory cache.
- In `PostCard`, attach an `IntersectionObserver` (root margin `800px`) that prefetches the post's first image's `card` variant when the card gets within ~one screen of the viewport. Result: by the time the user scrolls to it, the WebP is already in the browser cache.

### 6. (Same SignedSmartImage upgrade benefits) Messages, Fridge, Profile

No additional code in those files needed — they already render through `SignedSmartImage`/`SquareSignedThumbnail`, so the srcset + skeleton + fade-in land there too.

## Out of scope

- Storing image dimensions in the DB (would give perfect aspect ratios from the first paint, but requires a migration + upload-time changes). The natural-ratio swap on `onLoad` is the no-migration substitute.
- Service-worker / on-disk persistent cache.
- Video poster optimization.

## Files touched

```text
src/components/shared/SignedSmartImage.tsx
src/components/shared/SquareSignedThumbnail.tsx
src/components/feed/PostCard.tsx
src/pages/Feed.tsx
src/lib/postMediaUrl.ts
```

Pure web/JS. **No DB / RLS / edge function / iOS build changes — ships with the next Update, no App Store submission needed.**

## Expected impact

- Feed cards reserve space immediately → no more "text appears, image pops, layout jumps."
- Carousel tiles drop from ~80 KB to ~25–35 KB per slide on phones (thumb vs card preset).
- Retina phones now pull the right resolution via `srcset` instead of either over- or under-fetching.
- Off-screen posts are pre-warmed, so scrolling feels nearly instant after the first card.
- Progressive thumb→full fade-in gives a perceived <100 ms first paint on every tile, app-wide.
