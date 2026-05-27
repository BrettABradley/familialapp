-- 1. Avatars bucket: tighten upload + update policies
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] LIKE 'circle-%'
      AND public.is_circle_member(
        auth.uid(),
        substring((storage.foldername(name))[1] from 8)::uuid
      )
    )
    OR (
      (storage.foldername(name))[1] = 'group-chats'
      AND public.is_group_chat_member(
        auth.uid(),
        (storage.foldername(name))[2]::uuid
      )
    )
  )
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] LIKE 'circle-%'
      AND public.is_circle_member(
        auth.uid(),
        substring((storage.foldername(name))[1] from 8)::uuid
      )
    )
    OR (
      (storage.foldername(name))[1] = 'group-chats'
      AND public.is_group_chat_member(
        auth.uid(),
        (storage.foldername(name))[2]::uuid
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] LIKE 'circle-%'
      AND public.is_circle_member(
        auth.uid(),
        substring((storage.foldername(name))[1] from 8)::uuid
      )
    )
    OR (
      (storage.foldername(name))[1] = 'group-chats'
      AND public.is_group_chat_member(
        auth.uid(),
        (storage.foldername(name))[2]::uuid
      )
    )
  )
);

-- 2. circle_transfer_requests: enforce real ownership on INSERT
DROP POLICY IF EXISTS "Circle owners can create transfer requests" ON public.circle_transfer_requests;
CREATE POLICY "Circle owners can create transfer requests"
ON public.circle_transfer_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = from_user_id
  AND EXISTS (
    SELECT 1 FROM public.circles
    WHERE id = circle_id AND owner_id = auth.uid()
  )
);