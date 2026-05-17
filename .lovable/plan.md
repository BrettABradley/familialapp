# Image Zoom + Instagram-Style Carousel

Two related upgrades to the feed, profile, and albums, plus a fresh iOS build. **All changes apply to both the web app and the iOS app** (single shared codebase).

## 1. Pinch-to-zoom on images

**Where it applies**
- Lightbox in the Feed (`PostCard` — tap any post image → fullscreen)
- Personal profile avatars (`Profile.tsx` and `ProfileView.tsx` — tap big avatar to open in the lightbox)
- **Album photo viewer** (`Albums.tsx` lightbox — tap any album photo → fullscreen with zoom)
- Fridge photo viewer (same shared lightbox)

**Behavior**
- Two-finger pinch to zoom (1x–4x) on mobile/touch
- Double-tap to toggle between 1x and 2.5x
- One-finger pan when zoomed in
- Swipe-to-next/previous and swipe-down-to-close are **disabled while zoomed** (no gesture conflicts), re-enabled at 1x
- Desktop web: scroll-wheel + Ctrl/⌘ zoom, click-drag to pan, double-click to toggle

**Implementation**
- New `<ZoomableImage>` component wrapping `react-zoom-pan-pinch` (~12kb, touch-native, works in browser and Capacitor WebView)
- Drop it into the existing lightbox in `PostCard`, `Albums`, and a new tiny avatar lightbox

## 2. Instagram-style carousel for multi-image posts

**Limit**
- Max **5 images per carousel post** (up from current 4-file cap). The 5-cap applies to the post composer only — Albums keep their 100-photo limit.

**Posting side (`CreatePostForm`)**
- Raise the per-post file cap from 4 to 5
- Update the in-form preview from a 2-column grid to a swipeable carousel when 2+ images are selected

**Feed side (`PostCard`)**
- When a post has 2+ visual media, render as a single-frame swipeable carousel (current behavior is a 2-col grid)
- One image visible at a time, full width of the card, 4:5 aspect ratio (Instagram default)
- Dot indicators below ("● ○ ○ ○ ○")
- Small "1/5" counter top-right of the frame
- Tap any slide → opens lightbox at that index (zoom + swipe nav)
- Built on the existing `embla-carousel-react` / shadcn `Carousel` already in the project
- Single-image posts: unchanged (no carousel chrome)

**Caption stays singular** — one `content` field per post, exactly the Instagram model.

## 3. iOS rebuild

After the code changes land:
1. Pull latest from GitHub
2. `npm install --legacy-peer-deps` (picks up `react-zoom-pan-pinch`)
3. `npm run build`
4. `npx cap sync ios`
5. Archive & upload from Xcode

No new native permissions, no `Info.plist` changes, no entitlement changes — purely JS-layer additions. Existing push-notification build settings carry over.

## Files that will change

- `src/components/shared/ZoomableImage.tsx` *(new)* — pinch/pan/zoom wrapper
- `src/components/feed/PostCard.tsx` — visual-media grid → carousel; wrap lightbox image in `ZoomableImage`
- `src/components/feed/CreatePostForm.tsx` — raise cap to 5; preview grid → carousel
- `src/pages/Albums.tsx` — wrap album lightbox image in `ZoomableImage`
- `src/pages/Profile.tsx` — tappable own avatar → lightbox
- `src/pages/ProfileView.tsx` — tappable viewed avatar → lightbox
- `package.json` — add `react-zoom-pan-pinch`

## Out of scope (ask if you want them)

- Per-slide captions (Instagram doesn't do this either)
- Reordering selected images before posting
- Raising the album per-upload limit
- Zoom on inline (non-lightbox) thumbnails

Ready to build when you approve.
