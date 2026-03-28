

# Fix Lightbox Controls Position on Web

## Problem
The download and close buttons in the image/video lightbox are pushed too far down on desktop because of the mobile-specific `paddingTop: "max(env(safe-area-inset-top, 0px), 3.25rem)"` safe-area styling. On web, they should sit cleanly in the top-right corner of the image dialog.

## Changes

**File: `src/components/feed/PostCard.tsx`**

### Image lightbox top control bar (line 365)
- Replace inline `style={{ paddingTop: "max(...)" }}` with responsive classes
- Mobile: keep safe-area padding via inline style or `pt-[max(env(safe-area-inset-top,0px),3.25rem)]`
- Desktop (`sm:`): override to a simple `sm:pt-3 sm:pr-3` so the buttons sit neatly in the top-right corner of the dialog

### Video lightbox close button (line 431)
- Same fix: responsive padding so desktop gets `sm:pt-3 sm:pr-3` instead of the large safe-area offset

### Also apply to Albums lightbox (`src/pages/Albums.tsx`)
- Same responsive padding fix for the top control bar so it's consistent across the app

## Result
On mobile: buttons remain safely below the notch/Dynamic Island. On web: buttons sit tightly in the top-right corner of the lightbox dialog.

