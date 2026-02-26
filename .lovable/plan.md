

## Plan: Add HEIC loading toast + fix group/circle avatar upload errors

### Root cause of upload error
The storage policy for the `avatars` bucket restricts uploads to paths where the first folder matches the user's ID (`auth.uid()::text = (storage.foldername(name))[1]`). Group chat avatars upload to `group-chats/{groupId}/...` and circle avatars upload to `circles/{circleId}/...`, which don't match the user's ID and get rejected. The newer migration tried to add a permissive policy but the `DO` block found the existing policy name and skipped creation.

### Changes

#### 1. Database migration: fix storage upload policy
- Drop the restrictive `"Authenticated users can upload avatars"` INSERT policy
- Recreate it without the folder restriction, allowing any authenticated user to upload to the `avatars` bucket
- Same for the UPDATE policy

#### 2. Add HEIC conversion loading toast
In all files that call `convertHeicToJpeg` or `convertHeicFiles`, wrap the conversion with a toast notification so users see feedback during the (potentially slow) conversion:
- `src/components/feed/CreatePostForm.tsx`
- `src/pages/Messages.tsx` (2 handlers)
- `src/pages/Albums.tsx` (2 handlers)
- `src/pages/Circles.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Fridge.tsx`
- `src/pages/ProfileView.tsx`

Create a small wrapper in `src/lib/heicConverter.ts` that shows/dismisses a toast automatically when HEIC files are detected, e.g. `convertHeicWithToast(files, toast)`.

### Files to modify
- `src/lib/heicConverter.ts` — add toast-aware wrapper
- `src/components/feed/CreatePostForm.tsx`
- `src/pages/Messages.tsx`
- `src/pages/Albums.tsx`
- `src/pages/Circles.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Fridge.tsx`
- `src/pages/ProfileView.tsx`

### Files to create
- New database migration — fix avatars storage INSERT/UPDATE policies

