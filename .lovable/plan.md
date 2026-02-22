

# Feed Image Lightbox, Profile Revamp, and Linked Profiles

This plan covers three interconnected features:

## 1. Feed Image Lightbox (click to expand images)

Add a full-screen dialog/lightbox to the `PostCard` component so clicking any image in a post opens it enlarged, similar to the album photo lightbox already built.

- Add `enlargedImage` state to `PostCard`
- Wrap each image in the media grid with a clickable element
- Render a `Dialog` with the full-size image when clicked
- Include left/right navigation if the post has multiple images

## 2. Profile Page Split: Public Profile View + Settings (gear icon)

**Restructure the current `/profile` route into two distinct experiences:**

### A. New Public Profile Page (`/profile/:userId`)
- Shows the user's avatar (large), display name, bio, location
- Shows a gallery of profile images the user has uploaded (new feature)
- Viewable by anyone who shares a circle with this user (RLS already handles this via `shares_circle_with`)
- When viewing your own profile, show a gear icon that links to `/settings`

### B. Settings Page (`/settings`)
- Move all the current edit functionality (display name, bio, location, avatar upload) here
- Change the nav icon from "Profile" to use a `Settings` (gear) icon
- Keep the same edit form, just relocated

### C. Profile Images (new storage + table)
- Create a new `profile_images` database table: `id`, `user_id`, `image_url`, `caption`, `created_at`
- RLS: users can insert/update/delete their own; anyone sharing a circle can view
- Create a new `profile-images` storage bucket (public)
- On the public profile page, show a grid of uploaded images with the ability to add more (if it's your own profile)

## 3. Clickable Author Names in Feed Posts

- In `PostCard`, wrap the author's display name in a `Link` to `/profile/:userId` where `userId` is the post's `author_id`
- Same for comment author names
- This lets circle members navigate to any poster's public profile

## Route and Navigation Changes

- Add route `/profile/:userId` for viewing any user's profile
- Add route `/settings` for editing your own profile
- Update `MobileNavigation` to change the "Profile" item to point to `/settings` with a gear icon
- Update `CircleHeader` (desktop nav) similarly

## Database Migration

```sql
-- Profile images table
CREATE TABLE public.profile_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own images
CREATE POLICY "Users can insert own profile images"
  ON public.profile_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile images"
  ON public.profile_images FOR DELETE
  USING (auth.uid() = user_id);

-- Circle members can view
CREATE POLICY "Circle members can view profile images"
  ON public.profile_images FOR SELECT
  USING (
    auth.uid() = user_id
    OR shares_circle_with(auth.uid(), user_id)
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true);

-- Storage policies
CREATE POLICY "Users can upload profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

CREATE POLICY "Users can delete own profile images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/ProfileView.tsx` | **Create** - Public profile page with avatar, bio, image gallery |
| `src/pages/Settings.tsx` | **Create** - Renamed from current Profile (edit form) |
| `src/pages/Profile.tsx` | **Delete** or redirect to new structure |
| `src/components/feed/PostCard.tsx` | **Modify** - Add image lightbox dialog + clickable author names |
| `src/components/layout/MobileNavigation.tsx` | **Modify** - Change Profile to Settings with gear icon |
| `src/components/layout/CircleHeader.tsx` | **Modify** - Update nav link |
| `src/App.tsx` | **Modify** - Add `/profile/:userId` and `/settings` routes |

## Summary of User-Facing Changes

1. Clicking any image in the feed opens it full-size in a lightbox
2. The "Profile" tab becomes "Settings" (gear icon) for editing your info
3. A new public profile page shows your avatar, bio, location, and uploaded images
4. Clicking any person's name on a post takes you to their public profile
5. You can upload personal images to your profile that circle members can browse

