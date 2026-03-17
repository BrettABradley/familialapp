

## Plan: Make Video Player Respect Native Aspect Ratio

### Problem
The `VideoPlayer` forces `aspect-video` (16:9) on all videos. Vertical videos (9:16) get letterboxed with large black bars on the sides, looking awkward — especially on mobile where they should fill the width naturally.

### Solution
Remove the hardcoded `aspect-video` class. Instead, detect the video's native dimensions via `onLoadedMetadata` and apply a dynamic aspect ratio using inline `style={{ aspectRatio }}`. This way vertical videos display tall, horizontal videos display wide, and square videos display square — all at full width.

### Changes in `src/components/feed/PostCard.tsx`

**VideoPlayer component (~lines 42-105):**
1. Add state: `const [aspectRatio, setAspectRatio] = useState<string>("16/9")` (default fallback)
2. In `onLoadedMetadata`, read `videoRef.current.videoWidth` / `videoRef.current.videoHeight` and set the aspect ratio string (e.g. `"9/16"` for vertical)
3. Replace `className="... aspect-video object-contain"` with `object-contain` only, and add `style={{ aspectRatio }}` for dynamic sizing
4. Also update the placeholder div to use the same dynamic aspect ratio instead of `aspect-video`
5. Cap max height at `max-h-[600px]` so very tall vertical videos don't take over the entire feed

### No other files need changes.

