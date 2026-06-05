## Root cause (same as Albums was)

`SmartImage` rewrites Supabase URLs through the on-the-fly transformer, but **bails out for signed URLs** (the render endpoint won't validate sign tokens). Every surface that loads media from the private `post-media` bucket — Feed, Messages, Fridge, ProfileView — currently passes pre-signed URLs into `SmartImage` and gets the **full original** for every tile and lightbox image. That's why thumbs feel slow everywhere.

Albums already has the fix: it stores raw storage paths, and renders via `SignedSmartImage` / `SquareSignedThumbnail`, which produce signed URLs that include `{ transform: { width, quality, resize } }` — a CDN-cached ~30–80 KB WebP per thumbnail instead of a multi-MB JPEG.

Roll the same swap into the other four surfaces.

## Changes

### 1. Feed — `src/components/feed/PostCard.tsx`

- Stop pre-signing `post.media_urls` for rendering. Drop the `useSignedMediaUrls` call on line 389 (only kept for rendering — keep it only for the download handler if needed, or replace with on-demand `getPostMediaUrl(path)` in the download click).
- Pass raw storage paths down to `MediaItem`, `PostMediaCarousel`, and `FeedImagePreview`.
- Replace:
  - `SmartImage src=… preset="card"` → `SignedSmartImage path=… preset="card" lowPreset="thumb"`
  - `SquareImageThumbnail src=…` (the carousel grid tile) → `SquareSignedThumbnail path=…`
- `VideoThumbnail` and audio (`VoiceNotePlayer`) still need a real signed URL — keep `getPostMediaUrl(path)` for those specific cases.
- Download button: call `getPostMediaUrl(path)` (untransformed original) at click time.

### 2. Messages — `src/pages/Messages.tsx`

In `MessageMedia` (lines 90–149):
- Stop calling `useSignedMediaUrls(mediaUrls)` to pre-sign. Instead, work directly with `mediaUrls` (paths).
- For each item, branch on the bare path's extension via `getMediaType(path)`:
  - image → `<SignedSmartImage path={p} preset="card" lowPreset="thumb" … />`
  - video → keep current behavior but resolve the URL on demand with `useSignedMediaUrl(p)` (small per-video hook) — or wrap into a `MessageVideoTile` component.
  - audio → resolve via `useSignedMediaUrl(p)` and feed to `VoiceNotePlayer`.
- Lightbox open: still expects an array of resolved URLs. Resolve only the visual items lazily when the user taps (`Promise.all(visualPaths.map(p => getPostMediaUrl(p)))`) before opening — or keep a `useSignedMediaUrls(visualPaths)` solely for the lightbox; that's the one place full originals are appropriate.

### 3. Fridge — `src/pages/Fridge.tsx` + `src/components/fridge/FridgeBoard.tsx`

- `Fridge.tsx` line 95: stop pre-signing `pin.image_url` during fetch — store the raw path on the pin row.
- `FridgeBoard.tsx`:
  - Tile (line 211 `SquareImageThumbnail src={pin.image_url}`) → `SquareSignedThumbnail path={pin.image_url}`.
  - Audio/video at lines 199–209 and 378–388: resolve a signed URL on demand via `useSignedMediaUrl(pin.image_url)` for those branches (small wrapper components keep render clean).
  - Enlarged image (line 391 `SmartImage preset="full"`) → `SignedSmartImage path=… preset="full" lowPreset="card" priority`.

### 4. ProfileView — `src/pages/ProfileView.tsx`

ProfileView signs via its own `signProfileImage` helper into `image_url` strings. Two options; pick the smaller diff:
- **Preferred**: stop signing in `signProfileImage`/`signProfileImages` and store raw paths in `image_url`. Then:
  - All grid tiles `SquareImageThumbnail src={cover.image_url}` (lines 705, 924) → `SquareSignedThumbnail path={cover.image_url}`.
  - Lightbox image (line 126) → `SignedSmartImage path=… preset="full" lowPreset="thumb" priority={…}`.
  - Video tiles continue to need a signed URL; resolve per-item with `useSignedMediaUrl`.
  - Download / edit-crop flows still call `getPostMediaUrl(path)` for originals.

### 5. Helper tweak — `SignedSmartImage`

Already supports `lowPreset` (added in the album fix); no change required, just used in more places. Confirm no regressions when `lowPreset` is set but the underlying `useSignedMediaUrls` cache is cold (the hidden hi-res decoder fades in when ready — already implemented).

## Out of scope

- Service-worker / persistent CDN caching beyond the existing in-memory cache.
- Avatar bucket (separate flow — already small).
- Video poster frames (separate work; videos already use `<VideoThumbnail>`).

## Files touched

```text
src/components/feed/PostCard.tsx
src/pages/Messages.tsx
src/pages/Fridge.tsx
src/components/fridge/FridgeBoard.tsx
src/pages/ProfileView.tsx
```

No DB / RLS / edge function / iOS-build changes. Pure web/JS — ships with the next Update.

## Expected impact

Tiles in Feed, Messages, Fridge, and Profile go from multi-MB JPEG originals to ~30–80 KB WebP variants served from the CDN. Lightbox images get the same progressive thumb→full fade-in as Albums. First paint of a feed/message/profile view will feel dramatically snappier on cellular and iOS.
