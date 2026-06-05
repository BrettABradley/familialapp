
DROP POLICY IF EXISTS "post-media members can read" ON storage.objects;

CREATE POLICY "post-media members can read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'post-media'
  AND (
    -- Own folder
    (auth.uid())::text = (storage.foldername(name))[1]
    -- Circle avatars / shared circle folders
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND shares_circle_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    -- Posts media
    OR EXISTS (
      SELECT 1 FROM posts p
      WHERE p.media_urls IS NOT NULL
        AND is_circle_member(auth.uid(), p.circle_id)
        AND EXISTS (
          SELECT 1 FROM unnest(p.media_urls) u(u)
          WHERE u.u = objects.name
             OR u.u LIKE '%/post-media/' || objects.name
        )
    )
    -- Fridge pin images
    OR EXISTS (
      SELECT 1 FROM fridge_pins fp
      WHERE fp.image_url IS NOT NULL
        AND is_circle_member(auth.uid(), fp.circle_id)
        AND (fp.image_url = objects.name OR fp.image_url LIKE '%/post-media/' || objects.name)
    )
    -- Album photos
    OR EXISTS (
      SELECT 1 FROM album_photos ap
      JOIN photo_albums pa ON pa.id = ap.album_id
      WHERE is_circle_member(auth.uid(), pa.circle_id)
        AND (ap.photo_url = objects.name OR ap.photo_url LIKE '%/post-media/' || objects.name)
    )
    -- Album covers
    OR EXISTS (
      SELECT 1 FROM photo_albums pa
      WHERE pa.cover_photo_url IS NOT NULL
        AND is_circle_member(auth.uid(), pa.circle_id)
        AND (pa.cover_photo_url = objects.name OR pa.cover_photo_url LIKE '%/post-media/' || objects.name)
    )
    -- Campfire audio
    OR EXISTS (
      SELECT 1 FROM campfire_stories cs
      JOIN fridge_pins fp ON fp.id = cs.fridge_pin_id
      WHERE cs.audio_url IS NOT NULL
        AND is_circle_member(auth.uid(), fp.circle_id)
        AND (cs.audio_url = objects.name OR cs.audio_url LIKE '%/post-media/' || objects.name)
    )
    -- Private message media
    OR EXISTS (
      SELECT 1 FROM private_messages pm
      WHERE pm.media_urls IS NOT NULL
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM unnest(pm.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%/post-media/' || objects.name
        )
    )
    -- Group chat media
    OR EXISTS (
      SELECT 1 FROM group_chat_messages gm
      JOIN group_chat_members me ON me.group_chat_id = gm.group_chat_id AND me.user_id = auth.uid()
      WHERE gm.media_urls IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(gm.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%/post-media/' || objects.name
        )
    )
  )
);
