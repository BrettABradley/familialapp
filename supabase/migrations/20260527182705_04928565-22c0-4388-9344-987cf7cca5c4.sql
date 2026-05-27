
-- 1. Flip post-media bucket to private
UPDATE storage.buckets SET public = false WHERE id = 'post-media';

-- 2. Drop the unrestricted public SELECT policy
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;

-- 3. Gated SELECT policy: uploader, circle-mate, or DM partner
CREATE POLICY "post-media members can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.shares_circle_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE (pm.sender_id = auth.uid()    AND pm.recipient_id = ((storage.foldername(name))[1])::uuid)
         OR (pm.recipient_id = auth.uid() AND pm.sender_id    = ((storage.foldername(name))[1])::uuid)
    )
  )
);

-- 4. UPDATE policy scoped to uploader's folder (fixes warning)
DROP POLICY IF EXISTS "post-media uploader can update own files" ON storage.objects;
CREATE POLICY "post-media uploader can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
