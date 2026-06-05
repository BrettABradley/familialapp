## Root cause

Album photos are stored in the **private** `post-media` bucket, so each render goes through `getPostMediaUrl`, which calls `createSignedUrl(path, 3600)` — a `/storage/v1/object/sign/...` URL.

`src/lib/imageUrl.ts` explicitly **bails out of image transforms for signed URLs** (the render/image endpoint won't validate the sign token on a different path). So:

- Every album grid tile downloads the **full-resolution original** (often 3–8 MB iPhone JPEGs) instead of the 400-px `thumb` preset.
- The lightbox loads the same full original again, with no `full` (1600 px / quality 80) resize.

On iOS WebViews this is enough to:
1. Make the album grid feel "super slow" (dozens of multi-MB images decoded at once).
2. Make tapping a photo freeze the UI long enough that the user perceives it as a crash, after which iOS often pops the view back to the previous scroll position — they land on the album list. The "almost crashes the album section and takes me to the album home" symptom matches this exactly.

Supabase Storage **does** support transforms on signed URLs — you just have to pass `{ transform: { width, height, quality, resize } }` to `createSignedUrl`. The current code never uses that.

## Fix

### 1. Extend the signed-URL helper to support transforms (`src/lib/postMediaUrl.ts`)

- Add an optional `transform` arg to `getPostMediaUrl` / `getPostMediaUrls` / `useSignedMediaUrl` / `useSignedMediaUrls`.
- Key the in-memory cache by `path + transform variant` so the thumb and full versions are cached separately and don't evict each other.
- Pass `transform` straight through to `supabase.storage.from(BUCKET).createSignedUrl(path, TTL, { transform })`.

### 2. Add a preset-aware variant that mirrors `SmartImage` semantics

In `src/lib/imageUrl.ts` (or alongside it) expose a small `PRESET_TRANSFORM` map matching the existing presets:

```text
thumb  → { width: 400,  quality: 70, resize: 'contain' }
card   → { width: 800,  quality: 75, resize: 'contain' }
full   → { width: 1600, quality: 80, resize: 'contain' }
avatar → { width: 256, height: 256, quality: 80, resize: 'cover' }
```

### 3. Create `SignedSmartImage` (thin wrapper around `SmartImage`)

- Props: `path` (bare storage path or legacy URL), `preset`, `priority`, `alt`, `className`.
- Internally calls `useSignedMediaUrl(path, PRESET_TRANSFORM[preset])` and renders `<SmartImage src={signedUrl} preset={preset} priority={priority} ... />`. Because the URL it hands `SmartImage` is already correctly sized, `SmartImage`'s no-op transform path is fine.
- Shows the existing `bg-muted` placeholder while `loading` is true.

### 4. Switch Albums to render storage paths, not pre-signed URLs

In `src/pages/Albums.tsx`:

- Stop pre-signing in `fetchAlbums` / `fetchPhotos` — store the bare `photo_url` / `cover_photo_url` paths in state.
- Replace `AlbumImagePreview` with a version backed by `SignedSmartImage` (`preset="thumb"` for grid tiles, `preset="card"` for the cover, `preset="full"` for the lightbox image inside `AlbumPhotoLightbox`).
- Update the lightbox neighbor-preload effect to ask for the `full` transformed signed URL instead of `presetImage(...)` (which is a no-op for signed URLs).
- Keep `getPostMediaUrl` (untransformed) only where we need the true original — the **Download / Download All** handlers and the cover-upload flow.

### 5. Confirm the fix end-to-end

After the change:
- Album grid: each tile pulls a ~30–80 KB WebP via the render endpoint instead of a multi-MB JPEG — should be visibly snappy on a cold load.
- Tap a photo: lightbox opens a ≤1600 px WebP; no more multi-second freeze; the "drops back to album home" symptom goes away because the WebView no longer chokes.
- Download All / single Download still pull the full original (unchanged).

## Files touched

```text
src/lib/postMediaUrl.ts        ← add transform support + variant cache key
src/lib/imageUrl.ts            ← export PRESET_TRANSFORM map for reuse
src/components/shared/SignedSmartImage.tsx   ← new wrapper
src/pages/Albums.tsx           ← use paths + SignedSmartImage; update lightbox preload
```

No DB / RLS / edge function changes. No behavioral changes to upload, delete, cover, or download flows.

## Out of scope (intentionally)

- Feed / Messages / Fridge: they go through `getPostMediaUrl` too and would benefit from the same treatment, but the report is album-specific and you asked to fix this "asap". Happy to roll the same `SignedSmartImage` swap into those surfaces in a follow-up once we've confirmed the album fix in production.
- The unrelated security findings (Google Play RTDN auth, transactional email anon role check, post-media folder-ownership read shortcut) — separate work.
