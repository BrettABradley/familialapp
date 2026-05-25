
-- 1. Avatar overwrite vulnerability: drop redundant broad update policy
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;

-- 2. Post media upload path scope: require first folder to equal auth.uid()
DROP POLICY IF EXISTS "Circle members can upload post media" ON storage.objects;
CREATE POLICY "Circle members can upload post media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-media'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    EXISTS (SELECT 1 FROM public.circle_memberships WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.circles WHERE owner_id = auth.uid())
  )
);

-- 3. pending_unread_email_notifications: explicit deny-all for authenticated; service role unrestricted by RLS
CREATE POLICY "Service role manages pending unread email notifications"
ON public.pending_unread_email_notifications
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. circle_invites: drop inviter-side SELECT (token was exposed; inviter-side UI doesn't actually query this)
DROP POLICY IF EXISTS "Users can view invites they sent" ON public.circle_invites;

-- 5. user_appeals: remove user-side SELECT (token was exposed; users never view appeals in UI)
DROP POLICY IF EXISTS "Users can view own appeals" ON public.user_appeals;
CREATE POLICY "Platform admins can view appeals"
ON public.user_appeals FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- 6. store_offers: add platform admin SELECT
CREATE POLICY "Platform admins can view all store offers"
ON public.store_offers FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- 7. Function search_path hardening for the four pgmq helpers
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
