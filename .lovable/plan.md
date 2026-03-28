

# Fix Grey Side & Modernize ProfileView Lightbox

## Problem
The ProfileView lightbox at line 389 uses the old dialog style (`w-fit`) which causes a grey strip on mobile — same issue as the feed. It also lacks the fullscreen mobile treatment, safe-area handling, and navigation that feed/albums now have.

## Changes

**File: `src/pages/ProfileView.tsx`** (lines 387-430)

1. **DialogContent** — replace old classes with the same fullscreen mobile pattern used in PostCard/Albums:
   - `inset-0 bg-black/95 border-none p-0 flex flex-col items-center justify-center` for mobile
   - `sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-[95vw] sm:w-fit sm:rounded-lg sm:bg-background/95 sm:p-2` for desktop

2. **Top control bar** — safe-area-aware on mobile (`pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3 sm:pr-4`), with download and close buttons as 44×44 rounded ghost buttons

3. **Centered image** — `max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain`

4. **Navigation arrows** — add left/right ChevronLeft/ChevronRight arrows to navigate through `images` array (hidden at boundaries), plus swipe gesture support via `touchStartX` ref

5. **Image counter** — floating counter at bottom center showing position in gallery

**Also in the same change — Feed fix from prior approved plan:**

**File: `src/components/feed/PostCard.tsx`** (lines 362, 434)
- Change `w-fit` → `sm:w-fit` on both image and video lightbox DialogContent classes

## Files to modify
| File | Change |
|------|--------|
| `src/pages/ProfileView.tsx` | Replace lightbox dialog with fullscreen mobile pattern, add nav arrows + swipe |
| `src/components/feed/PostCard.tsx` | `w-fit` → `sm:w-fit` on both lightbox dialogs |

