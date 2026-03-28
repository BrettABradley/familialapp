

# Fix Grey Bar, Fridge Cropping & Campfire Layout

## 3 issues across 5 files

### 1. Grey bar on right side of all lightboxes

**Root cause:** In `PostCard.tsx` and `ProfileView.tsx`, the lightbox `DialogContent` uses `max-w-[95vw]` which applies on mobile too. Combined with `inset-0` (full-screen), this limits width to 95% of viewport, leaving a 5% gap on the right. In `Albums.tsx`, the lightbox uses `p-0` but doesn't override the base `px-6` padding (tailwind-merge keeps `px-6` over `p-0` since longhand beats shorthand).

**Fix:**
- `PostCard.tsx` and `ProfileView.tsx`: Change `max-w-[95vw]` → `max-w-none sm:max-w-[95vw]` so mobile gets full width
- `Albums.tsx`: Add `px-0 py-0` and `max-w-none sm:max-w-[95vw]` to the enlarged photo DialogContent

### 2. Fridge image cropping

**Current:** When uploading an image for a fridge pin, the file goes straight to upload with no cropping step.

**Fix:** After the user selects an image file, show the `AvatarCropDialog` (already used for profile photos) with `cropShape="rect"` and `aspect={1}` (square, matching the fridge's square pin display). The cropped blob replaces `selectedImage` and updates the preview. This mirrors the profile photo flow.

**File:** `src/pages/Fridge.tsx` — import `AvatarCropDialog`, add state for `cropSrc`, show crop dialog after file selection, use cropped result as `selectedImage`.

### 3. Campfire scene cut off at top

**Current:** The campfire hero div uses `pt-[max(env(safe-area-inset-top,0px),1.5rem)]` but the stars use absolute `top-2/3/5` positioning that sits behind the notch. The scene is top-heavy with empty space below.

**Fix:** Increase the hero's top padding to `pt-[max(env(safe-area-inset-top,0px),3rem)]` to push the whole scene down below the camera island. Shift star positions down accordingly (e.g. `top-3` → `top-12`). This centers the content better within the dialog.

**File:** `src/components/fridge/CampfireDialog.tsx`

## Files to modify

| File | Change |
|------|--------|
| `src/components/feed/PostCard.tsx` | `max-w-none sm:max-w-[95vw]` on lightbox |
| `src/pages/ProfileView.tsx` | `max-w-none sm:max-w-[95vw]` on lightbox |
| `src/pages/Albums.tsx` | Add `px-0 py-0 max-w-none sm:max-w-[95vw]` to photo lightbox |
| `src/pages/Fridge.tsx` | Add crop dialog for image pins using `AvatarCropDialog` |
| `src/components/fridge/CampfireDialog.tsx` | Increase hero top padding, shift stars down |

