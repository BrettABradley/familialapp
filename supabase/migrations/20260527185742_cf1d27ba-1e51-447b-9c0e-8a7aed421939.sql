
-- 1) circle_invites: hide the token column from clients via column-level GRANTs.
-- Server-side SECURITY DEFINER functions (lookup_circle_by_invite_code, join_circle_by_invite_code)
-- still read the token because SECURITY DEFINER runs as the function owner.
REVOKE SELECT ON public.circle_invites FROM authenticated;
REVOKE SELECT ON public.circle_invites FROM anon;
GRANT SELECT (id, circle_id, invited_by, email, status, created_at, expires_at)
  ON public.circle_invites TO authenticated;

-- 2) user_appeals: require an authenticated session and force user_id = auth.uid().
DROP POLICY IF EXISTS "Users can submit own appeals" ON public.user_appeals;
CREATE POLICY "Users can submit own appeals"
ON public.user_appeals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 3) post-media: replace blanket DM-participant read with per-file matching.
DROP POLICY IF EXISTS "post-media members can read" ON storage.objects;

CREATE POLICY "post-media members can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    -- Owner of the folder (userId/...) can always read their own files.
    (auth.uid())::text = (storage.foldername(name))[1]
    -- Or the viewer shares a circle with the file owner (feed, fridge, albums, campfire).
    OR public.shares_circle_with(
         auth.uid(),
         ((storage.foldername(name))[1])::uuid
       )
    -- Or the file is actually attached to a DM between the two users.
    OR EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE (
            (pm.sender_id = auth.uid()
             AND pm.recipient_id = ((storage.foldername(objects.name))[1])::uuid)
         OR (pm.recipient_id = auth.uid()
             AND pm.sender_id = ((storage.foldername(objects.name))[1])::uuid)
      )
      AND pm.media_urls IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(pm.media_urls) AS u
        WHERE u = objects.name OR u LIKE '%' || objects.name
      )
    )
    -- Or the file is attached to a group-chat message in a group the viewer belongs to.
    OR EXISTS (
      SELECT 1 FROM public.group_chat_messages gm
      JOIN public.group_chat_members me
        ON me.group_chat_id = gm.group_chat_id
       AND me.user_id = auth.uid()
      WHERE gm.media_urls IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(gm.media_urls) AS u
          WHERE u = objects.name OR u LIKE '%' || objects.name
        )
    )
  )
);
