

# Fix Fridge Lightbox: Controls & Safe-Area Positioning

## Problem
1. The close (X) and download buttons sit at `top-2 right-2` of the polaroid frame, which on mobile can land behind/under the Dynamic Island, making them unreachable.
2. The entire enlarged pin content (image + campfire) doesn't account for the notch/camera area, so content is partially obscured.

## Changes

**File: `src/components/fridge/FridgeBoard.tsx`**

### 1. Move action buttons outside the polaroid frame
- Move the download + X buttons from inside the polaroid `div` (line 363) to a separate top control bar above the polaroid, positioned absolutely within the `DialogContent`.
- Add safe-area padding: `pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3` so buttons clear the Dynamic Island on mobile.
- Use `justify-end` to keep them right-aligned with proper spacing.

### 2. Push polaroid content below the notch
- Change `DialogContent` from transparent centered layout to a fullscreen mobile layout (`fixed inset-0 bg-black/90 flex flex-col items-center justify-center`) with `sm:` overrides for desktop.
- The top control bar with safe-area padding naturally pushes the polaroid below the camera.

### Structure after fix
```text
DialogContent (fullscreen on mobile)
├── Top bar (safe-area padded) ── [Download] [X]
├── Polaroid frame (centered, below notch)
│   ├── Magnet
│   ├── Image/content
│   └── Caption
```

One file changed, same visual style preserved.

