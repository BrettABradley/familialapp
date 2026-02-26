

## Plan: Allow all circle members to change the circle profile photo

### Current state
- The `circles` table has an `avatar_url` column but it's never used in the UI
- The circle card shows an `AvatarFallback` with the first letter of the circle name — no photo upload exists
- RLS only allows the **owner** to UPDATE circles (`auth.uid() = owner_id`)
- There's no dedicated RLS policy for members to update the avatar

### Changes

#### 1. Add a permissive RLS policy for members to update circle avatar
Create a new database migration that adds a permissive UPDATE policy allowing any circle member to update `avatar_url` only. Since Postgres RLS can't restrict which columns are updated at the policy level, we'll use a trigger to prevent non-owners from changing other fields (name, description, etc.) while allowing avatar updates.

Alternative simpler approach: Add a **permissive** UPDATE policy for circle members, but use a **trigger** that ensures non-owners can only modify `avatar_url`.

#### 2. Add circle photo upload UI to the circle card
In `src/pages/Circles.tsx`:
- Add a camera/edit overlay on the circle Avatar in each card
- On click, open a file picker for images
- Upload the selected image to the `avatars` storage bucket (already public)
- Update the circle's `avatar_url` in the database
- Display the uploaded avatar in the Avatar component

#### 3. Display circle avatar throughout the app
- Update the Avatar in the circle card to show the `avatar_url` image when present
- Update `CircleHeader.tsx` to show the circle avatar if available (in the circle selector)

#### 4. Add storage policy for circle avatars
The `avatars` bucket is already public. Add an RLS policy on `storage.objects` for the `avatars` bucket to allow authenticated users to upload circle avatar files.

### Files to modify
- `src/pages/Circles.tsx` — add avatar upload UI + display
- `src/components/layout/CircleHeader.tsx` — display circle avatar
- New database migration — add permissive UPDATE policy for members + validation trigger
- New storage migration — ensure upload policy covers circle avatars

