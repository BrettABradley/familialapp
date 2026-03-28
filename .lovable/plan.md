

# Add Swipe Gesture Support to Feed & Album Lightboxes

## Problem
On mobile, users must tap small arrow buttons to navigate between images in lightboxes. Swiping left/right is the expected mobile interaction pattern.

## Approach
Add touch event handlers (`onTouchStart`, `onTouchEnd`) directly to the lightbox image elements in both files. No new dependencies needed — simple vanilla touch tracking with a swipe threshold.

## Changes

### 1. `src/components/feed/PostCard.tsx` — Feed image lightbox
- Add `touchStartX` ref to track swipe start position
- Attach `onTouchStart` and `onTouchEnd` handlers to the lightbox `img` element
- On swipe left (delta > 50px): advance to next image if available
- On swipe right (delta > 50px): go to previous image if available

### 2. `src/pages/Albums.tsx` — Album photo lightbox
- Same touch handler pattern on the enlarged photo `img` element
- Navigate through `photos` array using `setEnlargedPhoto`

## Technical detail

Both lightboxes will use the same pattern:

```tsx
const touchStartX = useRef<number>(0);

// On the img element:
onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
onTouchEnd={(e) => {
  const delta = touchStartX.current - e.changedTouches[0].clientX;
  if (delta > 50 && canGoNext) goNext();
  else if (delta < -50 && canGoPrev) goPrev();
}}
```

50px threshold prevents accidental swipes. No CSS changes needed.

## Files to modify
| File | Change |
|------|--------|
| `src/components/feed/PostCard.tsx` | Add touch swipe handlers to lightbox image |
| `src/pages/Albums.tsx` | Add touch swipe handlers to lightbox image |

