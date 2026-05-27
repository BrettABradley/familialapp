DROP POLICY IF EXISTS "post-media members can read" ON storage.objects;

CREATE POLICY "post-media members can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media' AND (
    -- 1. Owner of the top-level folder (covers new uploads userId/...)
    (auth.uid())::text = (storage.foldername(name))[1]

    -- 2. Top-level folder is a user UUID and viewer shares a circle with that user
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.shares_circle_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )

    -- 3. Referenced by a post in a circle the viewer belongs to
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.media_urls IS NOT NULL
        AND public.is_circle_member(auth.uid(), p.circle_id)
        AND EXISTS (
          SELECT 1 FROM unnest(p.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%' || objects.name
        )
    )

    -- 4. Referenced by a fridge pin in a circle the viewer belongs to
    OR EXISTS (
      SELECT 1 FROM public.fridge_pins fp
      WHERE fp.image_url IS NOT NULL
        AND public.is_circle_member(auth.uid(), fp.circle_id)
        AND (fp.image_url = objects.name OR fp.image_url LIKE '%' || objects.name)
    )

    -- 5. Referenced by an album photo in a circle the viewer belongs to
    OR EXISTS (
      SELECT 1
      FROM public.album_photos ap
      JOIN public.photo_albums pa ON pa.id = ap.album_id
      WHERE public.is_circle_member(auth.uid(), pa.circle_id)
        AND (ap.photo_url = objects.name OR ap.photo_url LIKE '%' || objects.name)
    )

    -- 6. Referenced as an album cover in a circle the viewer belongs to
    OR EXISTS (
      SELECT 1 FROM public.photo_albums pa
      WHERE pa.cover_photo_url IS NOT NULL
        AND public.is_circle_member(auth.uid(), pa.circle_id)
        AND (pa.cover_photo_url = objects.name OR pa.cover_photo_url LIKE '%' || objects.name)
    )

    -- 7. Campfire audio (via the parent fridge pin's circle)
    OR EXISTS (
      SELECT 1
      FROM public.campfire_stories cs
      JOIN public.fridge_pins fp ON fp.id = cs.fridge_pin_id
      WHERE cs.audio_url IS NOT NULL
        AND public.is_circle_member(auth.uid(), fp.circle_id)
        AND (cs.audio_url = objects.name OR cs.audio_url LIKE '%' || objects.name)
    )

    -- 8. DM attachment for either participant
    OR EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE pm.media_urls IS NOT NULL
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM unnest(pm.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%' || objects.name
        )
    )

    -- 9. Group chat attachment for any group member
    OR EXISTS (
      SELECT 1
      FROM public.group_chat_messages gm
      JOIN public.group_chat_members me
        ON me.group_chat_id = gm.group_chat_id AND me.user_id = auth.uid()
      WHERE gm.media_urls IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(gm.media_urls) u(u)
          WHERE u.u = objects.name OR u.u LIKE '%' || objects.name
        )
    )
  )
);