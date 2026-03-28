
# Fix Feed Image Lightbox on Mobile

## What’s going wrong
The feed lightbox is using a generic dialog that is top-anchored on mobile, and the feed lightbox then adds its own controls inside that scrollable layout. That causes:
- the image to appear oddly positioned instead of centered
- the close button to sit too high / too close to the iPhone status area
- users to feel “trapped” because the close affordance is hard to hit
- multi-image posts to use bottom controls instead of natural left/right navigation

## Implementation plan

### 1. Rework the feed image lightbox UI
**File:** `src/components/feed/PostCard.tsx`

Update the feed image lightbox to behave like a dedicated fullscreen mobile viewer instead of a standard form dialog:

- make the lightbox content a true fullscreen dark overlay on mobile
- vertically and horizontally center the opened image
- keep the image scaled with `object-contain` so it fills available space cleanly without cropping
- reserve top space for controls and bottom/side space so the image never sits under buttons

### 2. Move the close button lower and make it reliably tappable
**File:** `src/components/feed/PostCard.tsx`

Replace the current in-flow top row with an overlay control bar:

- position the close button absolutely/fixed within the lightbox
- place it below the iPhone top safe area, not flush against the top edge
- keep it at least a 44x44 tap target
- keep the default Radix close hidden for this custom lightbox so only the safe positioned close button is used

This avoids the current “can’t get out” trap on iPhone.

### 3. Add left/right overlay arrows for multi-image posts
**File:** `src/components/feed/PostCard.tsx`

For posts with multiple images:

- show a left arrow on the left side of the lightbox
- show a right arrow on the right side
- vertically center both arrows beside the image
- disable or hide the previous/next arrow at the ends
- keep the current image counter (for example `2 / 5`) in a small unobtrusive overlay

This will replace the current bottom navigation buttons with a more natural gallery experience.

### 4. Keep desktop behavior strong while optimizing mobile first
**File:** `src/components/feed/PostCard.tsx`

Use responsive classes so:
- mobile gets fullscreen centered lightbox behavior
- desktop still gets the enlarged web lightbox behavior already added
- the download button can stay available, but moved into the overlay controls so it doesn’t push the image down

### 5. Optional small shared adjustment if needed
**File:** `src/components/ui/dialog.tsx` only if necessary

I would avoid changing the global dialog unless the feed lightbox still inherits problematic spacing. If needed, I’d make only a minimal safe-area adjustment in the shared dialog so custom fullscreen media dialogs can opt into cleaner mobile positioning without affecting forms and other dialogs.

## Expected result
After this change:
- tapping a feed image on mobile opens it centered and properly sized
- the close button sits safely below the iPhone top area and is easy to tap
- users can move through multi-image posts with left/right arrows
- closing the viewer returns them cleanly to the same spot in the feed

## Files to modify
- `src/components/feed/PostCard.tsx`
- `src/components/ui/dialog.tsx` only if a small shared safe-area refinement is still needed
