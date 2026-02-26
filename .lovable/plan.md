

## Plan: Add HEIC/HEIF support across the platform

### Problem
HEIC/HEIF is Apple's default photo format. Browsers don't natively support displaying HEIC files, and `accept="image/*"` doesn't always include `.heic/.heif` on all platforms. We need to: (1) explicitly accept HEIC in file inputs, and (2) convert HEIC to JPEG client-side before upload/display.

### Approach
Install `heic2any` (a client-side HEIC-to-JPEG converter) and create a shared utility that detects HEIC files and converts them to JPEG blobs before uploading.

### Changes

#### 1. Install `heic2any` package
NPM package for client-side HEIC → JPEG conversion.

#### 2. Create shared conversion utility (`src/lib/heicConverter.ts`)
- Detect HEIC/HEIF by file type or extension
- Convert to JPEG blob using `heic2any`
- Return converted File object with `.jpg` extension

#### 3. Update all file input `accept` attributes to include `.heic,.heif`
7 locations across 7 files:
- `src/components/feed/CreatePostForm.tsx` — `accept="image/*,video/*,audio/*,.heic,.heif"`
- `src/pages/Messages.tsx` (2 inputs) — media input + group avatar input
- `src/pages/Albums.tsx` (2 inputs) — cover + photos
- `src/pages/Circles.tsx` — circle avatar
- `src/pages/Settings.tsx` — profile avatar
- `src/pages/Fridge.tsx` — fridge pin image
- `src/pages/ProfileView.tsx` — profile media

#### 4. Add HEIC conversion before upload in each upload handler
Before uploading, check if file is HEIC and convert. This affects the upload logic in:
- `CreatePostForm.tsx` → `handleFileSelect`
- `Messages.tsx` → `handleFileSelect` + `handleGroupAvatarUpload`
- `Albums.tsx` → `handleCoverUpload` + `handleFileUpload`
- `Circles.tsx` → `handleAvatarFileChange`
- `Settings.tsx` → `handleFileSelect`
- `Fridge.tsx` → `handleImageSelect`
- `ProfileView.tsx` → `handleFileSelect`

#### 5. Update `src/lib/mediaUtils.ts`
Add `heic` and `heif` to the image extension list in `getMediaType`.

### Files to create
- `src/lib/heicConverter.ts`

### Files to modify
- `src/lib/mediaUtils.ts`
- `src/components/feed/CreatePostForm.tsx`
- `src/pages/Messages.tsx`
- `src/pages/Albums.tsx`
- `src/pages/Circles.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Fridge.tsx`
- `src/pages/ProfileView.tsx`

