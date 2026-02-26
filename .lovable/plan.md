

## Plan: Album mass upload, Download All zip, cover crop, and profile media editing

### Changes

#### 1. Install `jszip` package
Required for client-side zip file generation for the "Download All" feature.

#### 2. Album: Mass upload up to 100 images
- Update the file input in `src/pages/Albums.tsx` to accept up to 100 files
- Add a progress indicator showing upload progress (e.g., "Uploading 12/50...")
- Add file size/count validation before starting

#### 3. Album: "Download All" as zip
- Add a "Download All" button in the album detail view header (top right area, next to existing buttons)
- On click, fetch all photo blobs, bundle into a zip using JSZip, and trigger download
- Show progress toast during zip creation

#### 4. Album: Cover photo crop dialog
- When setting a cover photo, open the `AvatarCropDialog` (generalized to support non-round crops) instead of uploading directly
- Modify `AvatarCropDialog` to accept an `aspect` and `cropShape` prop so it can be reused for rectangular cover crops (aspect 3:1)
- Upload the cropped result as the cover

#### 5. Profile: Crop dialog when adding media
- In `ProfileView.tsx`, after selecting a file for upload, if it's an image, open a crop dialog before the caption input
- Reuse the generalized crop dialog with square aspect ratio
- Upload the cropped result

#### 6. Profile: Edit button for caption and crop on existing profile images
- Add an "Edit" button in the lightbox view for own images
- On click, show a dialog with:
  - Textarea to edit the caption
  - Button to re-crop the image (opens crop dialog, uploads new version, updates URL)
- Requires an UPDATE RLS policy on `profile_images` for own images
- Database migration to add UPDATE policy

### Files to modify
- `src/components/profile/AvatarCropDialog.tsx` — generalize with `aspect` and `cropShape` props
- `src/pages/Albums.tsx` — mass upload progress, Download All zip, cover crop flow
- `src/pages/ProfileView.tsx` — crop on upload, edit caption/crop on existing images

### Files to create
- None (reuse existing crop component)

### Database migration
- Add UPDATE policy on `profile_images` for own images (`auth.uid() = user_id`)

### New dependency
- `jszip` for zip file creation

