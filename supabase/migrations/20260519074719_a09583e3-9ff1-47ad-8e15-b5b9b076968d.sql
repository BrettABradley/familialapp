ALTER TABLE public.profile_images
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

UPDATE public.profile_images SET group_id = id WHERE group_id IS NULL;

ALTER TABLE public.profile_images
  ALTER COLUMN group_id SET NOT NULL,
  ALTER COLUMN group_id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_profile_images_user_group_position
  ON public.profile_images (user_id, group_id, position);