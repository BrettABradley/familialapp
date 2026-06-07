# Fix blank previews + broken-image (?) on personal profile photos

## Root cause

The `profile-images` bucket is now private (verified: `public = false`), and the recent migration `20260605040758_…` replaced the public-read storage policy with one restricted to the folder owner / circle-shared viewers. But:

1. Existing `profile_images.image_url` rows still store the **legacy public URL** (`/storage/v1/object/public/profile-images/…`). I confirmed via psql + a HEAD request — that URL now returns `HTTP/2 400` because the bucket is private.
2. `ProfileView.tsx` signs URLs **once at fetch time** via `signProfileImage(...)`, but if signing fails for any reason it **silently falls back to the original public URL** (`if (error || !data?.signedUrl) return image_url;`). That broken URL is what the `<img>` ends up rendering → blank tile + the OS's "?" broken-image glyph in the lightbox.
3. The render path also relies on `createSignedUrl(..., { transform })`, whose returned URL points at `/storage/v1/render/image/sign/…`. Any single failure in that one-shot sign step leaves the user permanently looking at the legacy 400-ing public URL until refresh.

Meanwhile, the Feed/Albums/Fridge use a different, more resilient pipeline (`SignedSmartImage` + `useSignedMediaUrl` in `src/lib/postMediaUrl.ts`) that signs **on render**, **caches per-variant**, and shows a skeleton while loading. That pipeline works fine against the also-private `post-media` bucket. Profile just never got migrated to it.

## Fix (minimum scope, no behavior changes outside profile)

Migrate the profile photos page to the same signed-on-render pipeline the rest of the app already uses.

### 1. Generalize `src/lib/postMediaUrl.ts` to support multiple buckets

- Change every function (`getPostMediaUrl`, `getPostMediaUrls`, `prefetchSignedMediaUrl`, `useSignedMediaUrl`, `useSignedMediaUrls`, `toPostMediaPath`) to accept an optional `bucket` argument defaulting to `"post-media"`. Cache key becomes `${bucket}|${variantKey}`. The path-extraction regex switches from a hard-coded `/post-media/` marker to `/${bucket}/`.
- Existing call sites continue working unchanged because `bucket` defaults to `"post-media"`.

### 2. Add a `bucket` prop to `SignedSmartImage`

- New optional prop `bucket?: string` (default `"post-media"`) threaded into the `useSignedMediaUrl(path, transform, bucket)` call. Existing call sites unchanged.

### 3. Update `src/pages/ProfileView.tsx`

- Delete `extractProfileImagePath`, `signProfileImage`, `signProfileImages`, and the `PROFILE_CARD_TRANSFORM` constant.
- On fetch (around line 205-208), **store the bare storage path** instead of a signed URL — extract path from each `image_url` using the same regex (or `toPostMediaPath(value, "profile-images")`). State stays in `images: ProfileImage[]`, where `image_url` now holds the bare path (e.g. `"<uid>/<file>.jpg"`). Video media: store the bare path the same way; the on-render hook returns a plain signed URL (no transform) for non-images.
- Grid tile (line 718): replace `<SquareImageThumbnail src={cover.image_url} … />` with `<SquareSignedThumbnail path={cover.image_url} bucket="profile-images" … />` (the existing `SquareSignedThumbnail` already wraps `SignedSmartImage`; we add the same `bucket` pass-through there).
- Lightbox (line 139): replace `<SmartImage src={…} preset="full" …/>` with `<SignedSmartImage path={…} bucket="profile-images" preset="full" …/>`.
- Video tags (line 133, 716, 935): wrap with the existing `useSignedMediaUrl(path, undefined, "profile-images")` hook to resolve the `<video src>` on the fly.
- Selected-item previews from `pendingPreviews` (lines 875, 888) are blob URLs — those already pass through `toPostMediaPath` unchanged (blob/data short-circuit). No change needed there beyond keeping `SquareImageThumbnail` for blobs OR teaching `SquareSignedThumbnail` to pass blob: through (the underlying signed hook already does — verified in `useSignedMediaUrl`).
- On insert (line 411), keep storing the public URL in the DB for back-compat — we extract the path at render anyway. (Future cleanup: switch to storing bare paths and run a one-time backfill, but that's out of scope for this hotfix.)
- Avatar zoom dialog (line 755) uses the `avatars` bucket which is public — leave untouched.

### 4. Tighten the moderation call site

Line 444 sends `imageUrls: imageRows.map((r) => r.image_url)` to `moderate-content`. After the refactor those are bare paths, not URLs, so we sign them just-in-time before invoking moderation: `getPostMediaUrls(paths, undefined, "profile-images")` to produce throwaway short-TTL signed URLs the edge function can fetch.

### 5. Cleanup: `handleDownload` and other URL consumers

- `handleDownload(url)` at line 775 currently receives a URL. After the refactor it receives a path; resolve to a signed URL with `getPostMediaUrl(path, undefined, "profile-images")` before triggering the browser/native download.

## Why this fixes it

- Every render now produces a **fresh, valid signed URL** scoped to the viewer. No more silent fallback to a 400-ing public URL.
- The grid + lightbox show the SignedSmartImage skeleton while a signed URL is being minted, then fade in — same UX as Feed/Albums (matches the rest of the app, not new visual behavior).
- Signed URLs are cached per `(bucket, path, transform)`, so navigating between grid → lightbox → grid doesn't re-sign.
- No DB migration, no storage policy change, no bucket flip. Security posture from the recent migration stays exactly as the user approved it.

## Verification

After the change:
1. Open the personal profile in the preview as the logged-in owner — grid tiles render (no blank squares).
2. Open a photo in the lightbox — image displays (no `?` glyph).
3. Open another user's profile in a shared circle — same: tiles + lightbox load.
4. Open a profile of a user you DON'T share a circle with — tiles show skeleton then stay empty (correct: RLS denies). No JavaScript error.
5. Network panel: requests go to `/storage/v1/render/image/sign/profile-images/…?token=…&width=…` and return `200`. No request to the legacy `/object/public/…` URL.
6. Upload a new photo + check it appears immediately and survives a refresh.

## Files touched

- `src/lib/postMediaUrl.ts` — add optional `bucket` parameter (back-compat default `"post-media"`).
- `src/components/shared/SignedSmartImage.tsx` — add optional `bucket` prop.
- `src/components/shared/SquareSignedThumbnail.tsx` — pass `bucket` through.
- `src/pages/ProfileView.tsx` — switch grid/lightbox/video/download/moderation to the path-based signed flow; drop the legacy `signProfileImage*` helpers.

No backend / migration / edge-function changes. No changes to Feed, Albums, Fridge, Messages, or any other surface.
