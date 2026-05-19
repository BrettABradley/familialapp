## Problem

After enabling the ZoomableImage (pinch-zoom) feature, two visual regressions appeared:

1. **Profile pictures (avatars) are stretched** in posts and comments — the round avatar looks horizontally smushed (visible in your screenshot: Brett's PFP renders as horizontal stripes).
2. **Feed post images appear zoomed-in / auto-cropped**, even though nobody cropped them — full images get cut off on the sides/top/bottom.

## Root Causes

**1. Avatars stretched** — `src/components/ui/avatar.tsx`
The `AvatarImage` component is missing `object-cover`. It currently has only `aspect-square h-full w-full`, which forces the underlying `<img>` to stretch to fill the square box (no aspect preservation). Any non-square source image (portrait/landscape) gets squished. This is a long-standing shadcn issue but became very visible now that the on-the-fly transform serves a 128px-wide WebP — non-square originals stretch noticeably.

**2. Feed images cropped/zoomed** — `src/components/feed/PostCard.tsx`
The single-image feed tile (around line 201) and the carousel slides (around line 260) use `object-cover` on a fixed-aspect container. `object-cover` crops to fill, which is what causes the "zoomed in" feel — tall portrait photos lose their tops/bottoms, wide photos lose their sides. Before the zoom rollout, single images were rendered with `object-contain` and natural height (line 113 still does this for inline images). The carousel/grid switch to `object-cover` is what produces the perceived zoom.

## Fix

### Change 1 — Avatars (1 line)
`src/components/ui/avatar.tsx` line 22: add `object-cover` to `AvatarImage`:
```tsx
className={cn("aspect-square h-full w-full object-cover", className)}
```
This fixes every avatar everywhere (feed, comments, header, members, messaging) in one shot.

### Change 2 — Feed images show the whole photo
`src/components/feed/PostCard.tsx`:
- **Single-image post tile** (~line 195–205): render the image with natural aspect ratio (`w-full h-auto max-h-[600px] object-contain bg-muted`) instead of a fixed-aspect `object-cover` box. The image still opens the lightbox on tap.
- **Carousel slides** for 2+ images (~line 255–265): keep a uniform tile height but switch to `object-contain` with a neutral background (`bg-muted/40`) so portrait shots aren't cropped. This matches what users expect from Instagram-style "Show full photo" mode rather than a forced square crop.

No changes to `ZoomableImage` itself — the lightbox stays as-is (it already uses `object-contain`).

### Out of scope
- Albums grid and Fridge tiles intentionally use `object-cover` (those are thumbnail grids). Leaving them.
- Circle/header avatars: covered by Change 1.

## Verification
1. Open the feed on mobile preview — confirm Brett's avatar renders as a circular face (not horizontal stripes).
2. Post a portrait photo and a landscape photo — both should display fully, no cropping.
3. Tap a feed image — lightbox still opens, pinch-zoom still works.
4. Carousel post with 3 mixed-orientation images — all visible end-to-end, no zoom-crop.
