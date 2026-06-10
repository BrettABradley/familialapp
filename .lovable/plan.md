## Problem

On Android (and partially iOS), two flows are missing the native pickers we want:

1. **Feed "Add Media" and Profile avatar** — when tapped, the user only gets a photo-library picker. There is no option to take a real-time photo with the camera.
   - Feed (`src/components/feed/CreatePostForm.tsx`) uses a raw `<input type="file" accept="image/*,video/*">`. On Android Capacitor's webview this opens straight to the file/gallery picker — no camera choice surfaced.
   - Profile avatar (`src/pages/ProfileView.tsx` via `pickImage()`) hard-codes `CameraSource.Photos`, so even iOS never offers the camera.

2. **Album upload** — on Android, "Add Photos" only lets you pick one image at a time. The web `<input multiple>` does work on iOS Safari/WKWebView but Android's WebView file chooser commonly ignores `multiple` and returns a single file. The native fix is `Camera.pickImages({ limit })`.

iOS phone works "well enough" today for albums, but we should route both platforms through the Capacitor APIs on native so behavior is consistent.

## Fix

### 1. Extend `src/lib/imagePicker.ts`

- Add a `source` option to `pickImage()`: `'prompt' | 'photos' | 'camera'` (default `'prompt'`).
  - On native, map to `CameraSource.Prompt` so the OS shows a "Take Photo / Choose from Library" action sheet. (Keep the existing iPad guard — fall back to `Photos` when running on iPad, since `Prompt`'s action sheet still crashes there without a popover anchor.)
  - Reuse the existing `normalizeImageOrientation` pipeline.
- Add a new `pickImages(options?: { limit?: number })` helper:
  - On native: dynamic-import `@capacitor/camera` and call `Camera.pickImages({ quality: 90, limit })`. Map each returned `path`/`webPath` to a `File` via fetch + blob, then run through `normalizeImageOrientation`.
  - On web: reuse the existing hidden `<input type="file" multiple>` fallback and return an array of `PickedImage`.
  - Permission handling mirrors `pickImage()` (request `photos`, friendly error if denied).

### 2. Feed — `src/components/feed/CreatePostForm.tsx`

- Replace the `fileInputRef.current?.click()` triggers with a small helper:
  - On web: keep the existing hidden `<input>` (so video selection still works in the browser).
  - On native: call `pickImage({ source: 'prompt' })` for the "Add Media" button so the user gets the Take Photo / Photo Library sheet. (Video capture stays web-only for now — the existing input handles it on web.)
- Wire the picked file through the existing `handleFileSelect` size/HEIC/preview pipeline (extract its body into a `processFiles(files: File[])` function so both code paths feed into the same validation).

### 3. Profile avatar — `src/pages/ProfileView.tsx`

- Change the single `pickImage()` call (line ~326) to `pickImage({ source: 'prompt' })` so users can take a new selfie for their avatar.

### 4. Albums — `src/pages/Albums.tsx`

- On native: change the "Add Photos" button to call the new `pickImages({ limit: remainingSlots })` and pass the returned `File[]` straight into the existing `handleFileUpload`-equivalent path (refactor it to accept an array of files rather than reading from the `<input>`).
- On web: keep the current `<input type="file" multiple accept="image/*,.heic,.heif">` flow unchanged.

### 5. No changes needed to

- HEIC conversion (`heicConverter.ts`) — already applied downstream.
- Storage paths, RLS, or any backend.
- iOS native build — `@capacitor/camera` is already installed and configured.

## Files touched

```
src/lib/imagePicker.ts                       (extend + add pickImages)
src/components/feed/CreatePostForm.tsx       (native-aware add-media path)
src/pages/ProfileView.tsx                    (pass source: 'prompt')
src/pages/Albums.tsx                         (native pickImages multi-select)
```

## After implementation

Run `bash scripts/pull-updates.sh` then `npx cap open android` (and `ios`) and verify:
- Feed → Add Media → action sheet with Camera + Photo Library on both platforms.
- Profile → change avatar → same action sheet.
- Album → Add Photos → native multi-select returns multiple images on Android.
