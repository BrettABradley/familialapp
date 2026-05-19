## Goal
Bring Instagram-style multi-media posts to the personal profile "Photos" section: pick up to 4 photos/videos in one go, write one shared caption, and viewers tap a tile to open a swipeable carousel — same UX as the feed. Works on mobile iOS and web.

## Where this lives
- `src/pages/ProfileView.tsx` — grid + Add Media flow + lightbox
- `profile_images` table (Lovable Cloud) — currently one row per photo with its own caption; needs grouping

## Database change

Add two columns to `profile_images` so multiple rows can belong to one "post":

- `group_id uuid` — shared by every item in the same upload
- `position int` (default 0) — order within the group

Backfill: `UPDATE profile_images SET group_id = id WHERE group_id IS NULL`. Every existing photo becomes a one-item group automatically — nothing breaks. Add an index on `(user_id, group_id, position)` for fast grouped fetches.

Caption stays on each row, but the UI treats it as shared (same caption written to every row in a group on insert/edit).

## Upload flow (Add Media button)

1. Change file picker to `multiple`: `<input type="file" multiple accept="image/*,video/*,.heic,.heif">`.
2. After selection: cap at 4 files, run HEIC conversion on each one sequentially.
3. **Skip the square-crop step when 2+ files are selected.** Carousel slides render with `object-contain` (matches the feed fix from the last turn), so portrait photos stay intact. Single uploads keep the existing crop dialog so solo-post behavior is unchanged.
4. Caption dialog shows a small horizontal strip of thumbnails for all selected items with a "1/4" indicator, plus the shared caption textarea ("Write a caption (optional)…"). One Cancel and one Upload button.
5. On Upload: generate one `group_id = crypto.randomUUID()`, upload each file to storage **sequentially** (safer on iOS memory for 4×HEIC), insert one `profile_images` row per file with the same `group_id`, the shared `caption`, and `position` 0…n. Run the existing silent moderation pass per image.

## Grid (Photos section)

Group rows client-side by `group_id`. Each grid tile renders the **first** item of its group:
- Video play icon overlay (existing behavior) if first slide is a video.
- If group has 2+ items, overlay a small stacked-squares icon (Lucide `Layers`/`Copy`) plus a count chip ("4") in the top-right corner — same visual language as the feed multi-post counter.
- Tile aspect stays `aspect-square` with `object-cover` (intentional for the grid thumbnail look).

## Lightbox (tap a tile)

State becomes `{ group, index }` instead of a single image:
- Swipe left/right and arrow buttons cycle **within the group only**, not across the whole gallery — this is the key UX the user asked for: one carousel per post.
- Counter shows "index+1 / group.length".
- Caption + author block at bottom shows the shared caption (same for all slides).
- Edit / Delete buttons act on the **whole group**:
  - **Delete** removes all rows in the group and all storage files, behind a confirm dialog ("Delete this post? It contains N items.").
  - **Edit** updates `caption` on every row in the group at once. Re-crop is only enabled when the group has exactly 1 item (no per-slide re-crop UI for now).
- Images still use `ZoomableImage` (pinch-zoom stays). Slide media uses `object-contain` so portrait shots aren't cropped, matching the feed fix.

## Mobile + iOS specifics
- File `multiple` already works in Capacitor WKWebView; no native plugin needed.
- Sequential upload (not parallel) for memory safety on 4×HEIC iPhone photos.
- Safe-area-aware top/bottom paddings on the lightbox stay as they are.

## Out of scope
- Reordering slides after upload.
- Adding more items to an existing post.
- Per-slide captions (deliberately one shared caption — matches the request).

## Verification
1. As profile owner, tap **Add Media**, pick 3 photos + 1 video, type a caption, hit Upload — one tile appears in the grid with a "4" badge.
2. Tap the tile — lightbox opens at slide 1/4, swipe through all four, caption persists on every slide.
3. Edit → change caption → all slides reflect the new caption.
4. Delete → all four storage files + DB rows removed, tile disappears.
5. Existing single-photo posts display and behave exactly as before (no group badge, no carousel swipe).
6. Re-test on iOS TestFlight build after `cap:sync:ios` — multi-pick + lightbox swipe smooth.
