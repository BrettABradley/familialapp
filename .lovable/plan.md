# Fix grey video thumbnails in personal profile posts

## Problem
The current fix (`#t=0.1` URL hack with `preload="metadata"`) doesn't reliably paint a frame on iOS WKWebView. Many videos still show as grey tiles because:
- WKWebView often refuses to decode frames until user gesture
- Supabase Storage may not honor byte-range requests cleanly for `moov`-at-end MP4s
- `preload="metadata"` is hinted, not enforced

## Solution
Build a small `VideoThumbnail` component that grabs a real still frame and shows it as an `<img>` (or CSS background). The `<video>` element is removed from the grid entirely — only used briefly to capture the frame.

How it works:
1. Mount a hidden `<video muted playsInline crossOrigin="anonymous" preload="auto">` off-screen
2. On `loadeddata`, seek to ~0.1s
3. On `seeked`, draw the current frame to a `<canvas>` and export as a blob URL
4. Swap to `<img src={blobUrl}>` with the Play overlay
5. Cache the blob URL per video URL in a module-level `Map` so we don't redo work across re-renders/scroll
6. Cleanup blob URLs on unmount

Fallback: if the canvas read fails (CORS taint, decode error), fall back to a neutral placeholder with the Play icon — still better than the misleading grey "video" frame.

## Files to change
- **New** `src/components/shared/VideoThumbnail.tsx` — the component described above
- **Edit** `src/pages/ProfileView.tsx` (lines ~399–415) — replace the inline `<video>` + Play overlay with `<VideoThumbnail src={img.image_url} />`

## Notes
- This is an OTA JS change — no native rebuild needed.
- Supabase Storage already serves with permissive CORS, so `crossOrigin="anonymous"` + canvas export should work. If a specific bucket strips CORS, the fallback placeholder still hides the grey box.
- Same component can later be reused in Albums and Feed grids if you want consistent thumbnails everywhere.
