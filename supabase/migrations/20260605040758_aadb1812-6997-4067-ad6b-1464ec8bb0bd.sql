-- Replace public SELECT policy on profile-images storage with circle-scoped policy
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

CREATE POLICY "Circle members can view profile images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.shares_circle_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);