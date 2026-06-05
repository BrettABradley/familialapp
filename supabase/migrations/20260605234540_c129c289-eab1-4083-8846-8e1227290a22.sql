DROP POLICY IF EXISTS "post-media members can read" ON storage.objects;

CREATE POLICY "post-media members can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    -- Posts in a circle the requester is currently a member of
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.media_urls IS NOT NULL
        AND public.is_circle_member(auth.uid(), p.circle_id)
        AND EXISTS (
          SELECT 1 FROM unnest(p.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%/post-media/' || objects.name
        )
    )
    -- Fridge pin image in a circle the requester is currently a member of
    OR EXISTS (
      SELECT 1 FROM public.fridge_pins fp
      WHERE fp.image_url IS NOT NULL
        AND public.is_circle_member(auth.uid(), fp.circle_id)
        AND (fp.image_url = objects.name OR fp.image_url LIKE '%/post-media/' || objects.name)
    )
    -- Album photo in a circle the requester is currently a member of
    OR EXISTS (
      SELECT 1
      FROM public.album_photos ap
      JOIN public.photo_albums pa ON pa.id = ap.album_id
      WHERE public.is_circle_member(auth.uid(), pa.circle_id)
        AND (ap.photo_url = objects.name OR ap.photo_url LIKE '%/post-media/' || objects.name)
    )
    -- Album cover in a circle the requester is currently a member of
    OR EXISTS (
      SELECT 1 FROM public.photo_albums pa
      WHERE pa.cover_photo_url IS NOT NULL
        AND public.is_circle_member(auth.uid(), pa.circle_id)
        AND (pa.cover_photo_url = objects.name OR pa.cover_photo_url LIKE '%/post-media/' || objects.name)
    )
    -- Campfire story audio for a pin in a circle the requester is currently a member of
    OR EXISTS (
      SELECT 1
      FROM public.campfire_stories cs
      JOIN public.fridge_pins fp ON fp.id = cs.fridge_pin_id
      WHERE cs.audio_url IS NOT NULL
        AND public.is_circle_member(auth.uid(), fp.circle_id)
        AND (cs.audio_url = objects.name OR cs.audio_url LIKE '%/post-media/' || objects.name)
    )
    -- Private message attachments where the requester is sender or recipient
    OR EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE pm.media_urls IS NOT NULL
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM unnest(pm.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%/post-media/' || objects.name
        )
    )
    -- Group chat attachments where the requester is currently a member of the chat
    OR EXISTS (
      SELECT 1
      FROM public.group_chat_messages gm
      JOIN public.group_chat_members me
        ON me.group_chat_id = gm.group_chat_id AND me.user_id = auth.uid()
      WHERE gm.media_urls IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(gm.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%/post-media/' || objects.name
        )
    )
  )
);