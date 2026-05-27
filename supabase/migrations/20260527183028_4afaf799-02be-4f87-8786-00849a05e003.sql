
-- Restore public read on post-media until all client render sites + edge functions
-- are migrated to signed URLs. Keep the UPDATE policy (warning fix) in place.
UPDATE storage.buckets SET public = true WHERE id = 'post-media';

DROP POLICY IF EXISTS "post-media members can read" ON storage.objects;

CREATE POLICY "Anyone can view post media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');
