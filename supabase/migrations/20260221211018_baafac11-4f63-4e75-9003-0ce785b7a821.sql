-- Add foreign key from photo_albums.created_by to profiles.user_id
ALTER TABLE public.photo_albums
ADD CONSTRAINT photo_albums_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id);