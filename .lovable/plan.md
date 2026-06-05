## Goal

Make album photos appear faster in the lightbox. Today, opening a photo or swiping to one waits for the full 1600px WebP to download before anything paints. Neighbors are preloaded but only one slot ahead, and the current photo isn't warmed at all before mount.

## Changes (all in `src/pages/Albums.tsx`, plus a tiny helper)

### 1. Warm the current photo before the lightbox mounts

In the outer `Albums` component, the existing neighbor-preload effect (lines 245–257) only fires after `enlargedPhoto` is set — too late to help the photo the user just tapped. Update it so it also requests the `full` variant of the tapped photo with `fetchpriority="high"`, and extend the window from ±1 to ±2 neighbors at normal priority.

### 2. Move/extend the preload inside `AlbumPhotoLightbox`

Replace the current `[selected-1, selected+1]` preloader (lines 107–117) with:

- Preload `full` for `selected`, `selected±1`, `selected±2` (range configurable).
- Mark the `selected` image with `img.fetchPriority = "high"`; neighbors stay default.
- Bail out cleanly if `photos[i]` is missing (end of album).

Because signed URLs are cached by `(path, transform)` in `postMediaUrl.ts`, these preloads share the exact URL the `<SignedSmartImage>` later requests, so the browser serves it from cache instantly.

### 3. Progressive placeholder: paint the small variant first

Right now `SignedSmartImage` renders a grey `bg-muted` block while the 1600px WebP downloads — that's the perceived "slow". Add an optional `lowPreset` prop to `SignedSmartImage`:

- If `lowPreset` is set, render a second `<img>` underneath at that preset (e.g. `thumb`, ~30 KB) which almost always paints in <100ms because the grid already loaded it.
- The hi-res image stacks on top with `opacity-0 → opacity-100` once `onLoad` fires.

In the lightbox `<SignedSmartImage>` (line 167), pass `lowPreset="thumb"`. The grid tile is already cached, so swiping to a new photo shows a blurred thumb instantly and sharpens to full when the WebP arrives.

### 4. Widen the virtualization window from ±1 to ±2

Line 159: change `Math.abs(i - selected) <= 1` to `<= 2`. With the lower-res placeholder, the extra `ZoomableImage` instances are cheap (no full image decoded until needed). This makes left/right swipes feel instant on the first neighbor and still safe on iOS memory because we're capping at 5 mounted slides.

### 5. Tiny cleanup

The outer preloader (Albums lines 245–257) becomes redundant once the lightbox preloads its own current+neighbors on every `selected` change. Keep only the "warm on tap" part (current photo high-priority + ±1 neighbors normal priority) so the very first paint after tapping a tile is fast; delete the rest.

## Files touched

```text
src/components/shared/SignedSmartImage.tsx    ← add optional lowPreset prop + fade-in
src/pages/Albums.tsx                          ← improved preload effects, ±2 window, lowPreset="thumb" in lightbox
```

No changes to `postMediaUrl.ts`, `imageUrl.ts`, `ZoomableImage`, RLS, edge functions, downloads, or upload flow.

## Out of scope

- Feed / Messages / Fridge lightboxes (same pattern would help but the user asked specifically about albums today).
- Service-worker caching of signed URLs.
- No new iOS build required — pure web/JS change.
