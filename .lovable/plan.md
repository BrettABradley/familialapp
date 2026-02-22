

## Video Thumbnail Preview in Feed

### Problem
When videos are posted in the feed, they show a blank grey/white box until the user hits play. The current `poster` attribute using `url#t=0.5` doesn't work reliably across browsers, and the fade-in-on-load effect makes it worse by hiding the video element until data loads.

### Solution
Generate a real thumbnail from the video's first frame using an off-screen `<video>` + `<canvas>` technique. This captures an actual frame from the video and uses it as the poster image, so users always see a preview.

### How It Works
1. When a video `MediaItem` mounts, a hidden `<video>` element loads the video URL
2. It seeks to 0.5 seconds (to skip potential black frames)
3. Once seeked, it draws the current frame onto a `<canvas>`
4. The canvas is converted to a data URL and set as the `poster` attribute on the visible video player
5. The video fades in smoothly once the thumbnail is ready

### Changes

**`src/components/feed/PostCard.tsx`**
- Extract the video rendering into a dedicated `VideoPlayer` component within the file
- Add a `useEffect` that:
  - Creates a temporary offscreen `<video>` element
  - Sets `crossOrigin="anonymous"` and seeks to 0.5s
  - On `seeked` event, draws the frame to an offscreen `<canvas>`
  - Calls `canvas.toDataURL()` and stores it in state as the poster
- The visible `<video>` element uses this generated poster
- Remove the `opacity: 0` / `onLoadedData` fade trick (no longer needed since the poster provides immediate visual content)
- Show a subtle loading skeleton/placeholder while the thumbnail generates (typically under 1 second)

### What Users Will See
- Videos in the feed immediately show a thumbnail of the first frame instead of a blank grey box
- The play button overlays the thumbnail as expected
- No layout shift or flash of empty content

### Technical Notes
- `crossOrigin="anonymous"` is needed for canvas to read pixels from the video (Supabase storage supports CORS)
- Falls back gracefully: if thumbnail generation fails (e.g., CORS issues), the video still works normally, just without a poster
- No backend changes needed -- this is purely a frontend enhancement
