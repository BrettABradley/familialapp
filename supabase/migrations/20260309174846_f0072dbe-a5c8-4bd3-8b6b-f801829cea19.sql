
-- Fix 1: Create secure RPC for invite code lookup (replaces broad SELECT policy)
CREATE OR REPLACE FUNCTION public.lookup_circle_by_invite_code(_invite_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM circles c
  WHERE c.invite_code = _invite_code
  LIMIT 1;
$$;

-- Drop the overly broad SELECT policy that exposes all circles
DROP POLICY IF EXISTS "Users can look up circles by invite code" ON public.circles;

-- Fix 2: Replace the broken "join via invite code" INSERT policy
-- The old policy only checked that the circle exists, not that the user has the code
DROP POLICY IF EXISTS "Users can join via invite code" ON public.circle_memberships;

-- Fix 3: Fix notification spoofing - restrict INSERT to own user_id
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users can create own notifications"
ON public.notifications
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

-- Fix 4: Add circle membership checks to reactions INSERT
DROP POLICY IF EXISTS "Users can add reactions" ON public.reactions;
CREATE POLICY "Users can add reactions"
ON public.reactions
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND post_id IN (
    SELECT p.id FROM posts p
    WHERE p.circle_id IN (
      SELECT cm.circle_id FROM circle_memberships cm WHERE cm.user_id = auth.uid()
    )
    OR p.circle_id IN (
      SELECT c.id FROM circles c WHERE c.owner_id = auth.uid()
    )
  )
);

-- Fix 4b: Add circle membership checks to comments INSERT
DROP POLICY IF EXISTS "Circle members can create comments" ON public.comments;
CREATE POLICY "Circle members can create comments"
ON public.comments
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = author_id
  AND post_id IN (
    SELECT p.id FROM posts p
    WHERE p.circle_id IN (
      SELECT cm.circle_id FROM circle_memberships cm WHERE cm.user_id = auth.uid()
    )
    OR p.circle_id IN (
      SELECT c.id FROM circles c WHERE c.owner_id = auth.uid()
    )
  )
);
