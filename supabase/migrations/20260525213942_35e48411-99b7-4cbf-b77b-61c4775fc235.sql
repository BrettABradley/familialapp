
-- Allow users to overwrite their own profile images
CREATE POLICY "Users can update own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to submit appeals for themselves
CREATE POLICY "Users can submit own appeals"
ON public.user_appeals FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
