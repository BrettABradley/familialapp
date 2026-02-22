
-- Profile images table
CREATE TABLE public.profile_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile images"
  ON public.profile_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile images"
  ON public.profile_images FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Circle members can view profile images"
  ON public.profile_images FOR SELECT
  USING (
    auth.uid() = user_id
    OR shares_circle_with(auth.uid(), user_id)
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true);

CREATE POLICY "Users can upload profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

CREATE POLICY "Users can delete own profile images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);
