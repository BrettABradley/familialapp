
-- Fix 1: group_chat_members INSERT policy - replace overly permissive OR branch
-- The current policy allows ANY authenticated user to add themselves via (auth.uid() = user_id).
-- Replace with circle membership check so only circle members can join group chats.
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_chat_members;

CREATE POLICY "Group creators can add members" ON public.group_chat_members
FOR INSERT TO public
WITH CHECK (
  -- Creator can add anyone
  (group_chat_id IN (
    SELECT gc.id FROM group_chats gc WHERE gc.created_by = auth.uid()
  ))
  OR
  -- Users can add themselves ONLY if they belong to the circle the group chat is in
  (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_chats gc
      WHERE gc.id = group_chat_id
      AND is_circle_member(auth.uid(), gc.circle_id)
    )
  )
);

-- Fix 2: circle_rescue_offers INSERT policy - add circle ownership validation
-- Current policy only checks current_owner = auth.uid() but doesn't verify the user owns that circle.
DROP POLICY IF EXISTS "Owners can create rescue offers" ON public.circle_rescue_offers;

CREATE POLICY "Owners can create rescue offers" ON public.circle_rescue_offers
FOR INSERT TO authenticated
WITH CHECK (
  current_owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM circles c
    WHERE c.id = circle_id
    AND c.owner_id = auth.uid()
  )
);
