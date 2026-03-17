

## Plan: Fix Video Layout in Mixed-Media Posts + Fix Header Nav Overlap

### Issue 1: Video + Photo Mixed Layout

**Current behavior**: Images render in a 2-column grid (`grid-cols-2` with `aspect-square`), and videos render separately below in a `space-y-2` block. This creates two problems:
- Videos are visually disconnected from the image collage
- Videos are constrained to `max-h-[400px]` which kills resolution on larger screens

**Fix in `src/components/feed/PostCard.tsx`**:
- When a post has BOTH images and videos, render videos as full-width items ABOVE the image grid (videos are the hero content)
- Remove `max-h-[400px]` from VideoPlayer; use `aspect-video` with `object-contain` instead so native resolution is preserved
- Videos always render full-width (never in the 2-col grid) since cramming a video into a square cell destroys the aspect ratio
- Keep images in their existing collage grid below
- On mobile, same layout works naturally since full-width is already the single column

**Changes to `VideoPlayer` component**:
- Replace `max-h-[400px]` with `aspect-video object-contain` for proper scaling
- Ensure `w-full` so it fills the container

**Changes to media layout section** (lines 261-315):
- Render videos first (full-width, stacked), then images in grid below
- This gives videos visual prominence and prevents the awkward side-by-side with square image crops

### Issue 2: Header Nav Overlapping on Desktop

**Current behavior** (line 225-277): The left `div` contains logo + circle selector + notification bell (on `!isMobile`). The desktop nav is absolutely centered (`xl:absolute xl:left-1/2 xl:-translate-x-1/2`). When the circle name is long or with the bell, the left section grows and overlaps the centered nav.

**Fix in `src/components/layout/CircleHeader.tsx`**:
- Move the notification bell OUT of the left div for desktop
- Place bell + Sign Out on the RIGHT side of the header (only at xl+), mirroring a standard `left | center | right` layout
- Keep the mobile layout unchanged (bell stays in the `ml-auto` section with the fridge pin)
- The left section becomes: logo + circle selector only
- The right section (xl+): bell + sign out button
- This prevents any overlap since left, center, and right each have their own flex region

### Files to modify
- `src/components/feed/PostCard.tsx` — Video layout and resolution fix
- `src/components/layout/CircleHeader.tsx` — Move bell to right side on desktop

