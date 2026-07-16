
DROP POLICY IF EXISTS "Group creators can add members" ON public.group_chat_members;
CREATE POLICY "Group creators can add members"
ON public.group_chat_members
FOR INSERT
WITH CHECK (
  (
    -- Creator adding someone: added user must be a member of the group's circle
    (group_chat_id IN (SELECT gc.id FROM group_chats gc WHERE gc.created_by = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM group_chats gc
      WHERE gc.id = group_chat_members.group_chat_id
        AND public.is_circle_member(group_chat_members.user_id, gc.circle_id)
    )
  )
  OR
  (
    -- Self-join: user joining themselves must be a member of the group's circle
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_chats gc
      WHERE gc.id = group_chat_members.group_chat_id
        AND public.is_circle_member(auth.uid(), gc.circle_id)
    )
  )
);
