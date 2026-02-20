

## Fix Favicon White Background

### Problem
The current `public/favicon.png` still contains a white background despite previous attempts to remove it. The cache-busting parameter (`?v=2`) was added but the underlying image file is the issue.

### Plan

1. **Copy the uploaded image directly** as `public/favicon.png` using the original upload (`Familial_PNG_Black_-_watermark-3.png`) without any processing
2. **Bump the cache-busting parameter** in `index.html` from `?v=2` to `?v=3` to force browsers to reload

### Important Note
If the original uploaded PNG has a white background embedded in it (i.e., it was not exported with transparency), the favicon will still appear with a white background. In that case, you would need to re-export the logo from your design tool (Canva, Figma, etc.) with:
- **Transparent background** enabled
- **PNG format** (not JPG, which doesn't support transparency)

### Technical Details
- File change: `public/favicon.png` -- replaced with direct copy of uploaded file
- File change: `index.html` -- update `href="/favicon.png?v=2"` to `href="/favicon.png?v=3"`
