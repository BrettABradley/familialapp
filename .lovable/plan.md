

# Apply Feed Lightbox Fix to Albums

## Problem
The Albums photo lightbox uses the old dialog layout (top-anchored on mobile, controls in-flow, no safe-area handling), causing the same "trapped" experience as the feed had before the fix.

## Change

**File: `src/pages/Albums.tsx`** (lines 589-670)

Replace the current enlarged photo dialog with the same fullscreen mobile pattern used in PostCard:

1. **DialogContent** — use the same class string: `inset-0` for fullscreen on mobile, centered modal on desktop via `sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]`, black background, no padding/border on mobile, `flex flex-col items-center justify-center`, hide default close button
2. **Top control bar** — absolutely positioned with `paddingTop: "max(env(safe-area-inset-top, 0px), 3.25rem)"` for safe-area clearance; contains download and close buttons as 44x44 rounded ghost buttons with `bg-black/40 backdrop-blur-sm`
3. **Centered image** — `max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain`
4. **Navigation arrows** — absolutely positioned left/right at `top-1/2` with 44x44 tap targets, hidden at boundaries
5. **Image counter** — absolutely positioned at bottom center with safe-area-aware margin
6. **Caption** — positioned below the counter if present

This is a direct port of the PostCard lightbox pattern, adapted to use the `photos` array and `enlargedPhoto` state.

## Files to modify
| File | Change |
|------|--------|
| `src/pages/Albums.tsx` | Replace lightbox dialog (lines 589-670) with fullscreen mobile pattern |

