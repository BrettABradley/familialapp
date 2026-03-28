

# Swipe Gestures, Profile Centering & Fridge Cropping

## 3 changes across 4 files

### 1. Add swipe-down-to-close on all lightboxes (Feed, Albums, ProfileView)

Currently all three lightboxes track `touchStartX` for horizontal swipe. Add a companion `touchStartY` ref and on `onTouchEnd`, if the vertical delta exceeds 80px downward (and horizontal delta is small), close the lightbox.

**Files:** `src/components/feed/PostCard.tsx`, `src/pages/Albums.tsx`, `src/pages/ProfileView.tsx`

Pattern (same in all three):
```tsx
const touchStartY = useRef<number>(0);

// onTouchStart: also record Y
touchStartY.current = e.touches[0].clientY;

// onTouchEnd: check vertical swipe first
const deltaX = touchStartX - e.changedTouches[0].clientX;
const deltaY = e.changedTouches[0].clientY - touchStartY; // positive = swipe down
if (deltaY > 80 && Math.abs(deltaX) < 50) { close(); return; }
// ...existing horizontal logic
```

This applies to:
- Feed image lightbox `img` element
- Albums lightbox `img` element  
- ProfileView lightbox `img` element

### 2. Center the profile photo lightbox content vertically

**File:** `src/pages/ProfileView.tsx` (line ~390)

The `DialogContent` already has `flex flex-col items-center justify-center`. The issue is the caption/action area at the bottom pushes content upward. Change the layout so the image sits in a centered flex-grow area and the bottom caption uses absolute positioning (already partly does). Ensure `min-h-0` on the image container so flexbox centering works properly on mobile.

### 3. Crop fridge pin images to square on the board

**File:** `src/components/fridge/FridgeBoard.tsx`

The board thumbnails already use `aspect-square object-cover` (line 209) so images are cropped square on the board. The video thumbnails at line 196-212 also handle this. No change needed for board thumbnails — they're already cropped.

For the **enlarged pin dialog** (the polaroid popup), images currently show at natural aspect (`w-full`). To maintain consistency with the board's square crop, add `aspect-square object-cover` to the enlarged image (line 386-390) and video (line 373-377) — but **exclude campfire** pins since those already have their own layout. This ensures what you see on the board matches what you see when you tap it.

## Files to modify

| File | Changes |
|------|---------|
| `src/components/feed/PostCard.tsx` | Add `touchStartY` ref, swipe-down-to-close on image lightbox |
| `src/pages/Albums.tsx` | Add `touchStartY` ref, swipe-down-to-close on album lightbox |
| `src/pages/ProfileView.tsx` | Add `touchStartY` ref, swipe-down-to-close, center lightbox content |
| `src/components/fridge/FridgeBoard.tsx` | Add `aspect-square object-cover` to enlarged pin image/video |

