# Fix: Download Image not saving to Camera Roll on iOS

## Problem
In `src/lib/nativeDownload.ts`, we call `Media.savePhoto({ path: url })` with a **remote https URL**. The `@capacitor-community/media` plugin on iOS expects a **local file URI** (`file://...`). Passing a remote URL silently fails (or only opens the permission prompt), so the second tap never actually writes anything to the camera roll. iOS permission strings are already configured correctly in `scripts/ios-post-sync.sh`, so this is purely a JS-side bug.

## Fix
Rewrite the native branch of `downloadFile()` to:

1. `fetch(url)` → blob → base64.
2. Write the file to `Directory.Cache` via `Filesystem.writeFile` to get a local `file://` URI.
3. Pass that local URI to `Media.savePhoto({ path: localUri })` (or `saveVideo` for videos).
4. On success, show a success toast ("Saved to Photos"). On failure, fall back to the existing `Share.share({ url: localUri })` share-sheet flow so the user can still "Save Image" manually.
5. Clean up the cache file after save (best-effort `Filesystem.deleteFile`).

No other call sites change — `downloadFile()` keeps the same signature.

## Files
- `src/lib/nativeDownload.ts` — rewrite the native image/video branch as described.

## Verification
- iOS native: tap Download on a feed image → grant Photos permission → image appears in Camera Roll immediately, toast confirms.
- iOS native: tap Download a second time → image saves again, no permission prompt.
- Web: unchanged anchor-tag download still works.
