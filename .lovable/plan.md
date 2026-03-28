

# Make Image Lightboxes Full-Size on Web

## Problem
Image lightbox dialogs are constrained to `max-w-3xl`/`max-w-4xl` and images to `max-h-[75vh]`, making them appear small on desktop viewports.

## Changes

### 1. `src/pages/ProfileView.tsx` — Profile photo lightbox
- Change `DialogContent` from `max-w-3xl` to `max-w-[95vw] w-fit`
- Change image/video `max-h-[75vh]` to `max-h-[90vh]`

### 2. `src/components/feed/PostCard.tsx` — Feed post lightbox
- Change `DialogContent` from `max-w-4xl` to `max-w-[95vw] w-fit`
- Change image/video `max-h-[75vh]` to `max-h-[90vh]`

### 3. `src/pages/Albums.tsx` — Album photo lightbox
- Change `DialogContent` from `max-w-3xl` to `max-w-[95vw] w-fit`
- Change image/video `max-h-[75vh]` to `max-h-[90vh]` (if present)

Using `w-fit` ensures the dialog shrinks to the image's natural width rather than always being full-width, while `max-w-[95vw]` lets large images use nearly the full screen. `max-h-[90vh]` gives images more vertical room while still leaving space for captions and action buttons.

