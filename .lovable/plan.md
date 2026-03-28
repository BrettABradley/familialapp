

# Fix Grey Strip & Unified Media Swipe in Lightboxes

## Problems
1. **Grey strip on right side** of feed and profile lightboxes — caused by Tailwind CSS specificity: the dialog base class applies `px-6` which isn't overridden by `p-0` (both generate equal-specificity rules, and `px-*` appears later in the Tailwind stylesheet).
2. **Videos missing from swipe navigation** in feed lightbox — images and videos use separate lightbox dialogs, so swiping only cycles through images and skips videos entirely.

## Changes

### 1. Fix grey strip (Feed + Profile lightboxes)
**Files:** `src/components/feed/PostCard.tsx`, `src/pages/ProfileView.tsx`

Add explicit `px-0 py-0` to both image and video `DialogContent` classes to guarantee the base `px-6` padding is overridden. This ensures the black background fills edge-to-edge.

### 2. Unify media into one swipeable lightbox (Feed)
**File:** `src/components/feed/PostCard.tsx`

- Replace `imageUrls` with `visualMedia` (already computed at line 249 — includes both images and videos) as the lightbox data source.
- Remove the separate `videoLightboxUrl` state and its dedicated video `Dialog`.
- Update `lightboxIndex` to index into `visualMedia` instead of `imageUrls`.
- In the lightbox, check `getMediaType(visualMedia[lightboxIndex])`:
  - If `image` → render `<img>` (as now)
  - If `video` → render `<video controls autoPlay>` inline
- Both image and video elements get the same swipe/touch handlers, so swiping works seamlessly across media types.
- Update `MediaItem`'s `onVideoClick` to call the same `setLightboxIndex` (finding the video's index in `visualMedia`) instead of opening a separate dialog.
- Navigation arrows and counter use `visualMedia.length` instead of `imageUrls.length`.

### 3. Add swipe gestures to video elements in ProfileView
**File:** `src/pages/ProfileView.tsx`

The profile lightbox already supports both images and videos in one gallery, but the `<video>` element (line 419-424) lacks touch handlers. Add the same `onTouchStart`/`onTouchEnd` swipe+dismiss handlers to the video element.

## Files to modify

| File | Change |
|------|--------|
| `src/components/feed/PostCard.tsx` | Add `px-0 py-0` to DialogContent; merge image+video into single lightbox using `visualMedia`; remove separate video dialog |
| `src/pages/ProfileView.tsx` | Add `px-0 py-0` to DialogContent; add swipe handlers to video element |

