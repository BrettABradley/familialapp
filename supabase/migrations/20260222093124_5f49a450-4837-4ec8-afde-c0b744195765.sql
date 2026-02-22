
-- Fix infinite recursion in group_chat_members SELECT policy
DROP POLICY IF EXISTS "Members can view group chat members" ON public.group_chat_members;
CREATE POLICY "Members can view group chat members"
ON public.group_chat_members
FOR SELECT
USING (auth.uid() = user_id OR group_chat_id IN (
  SELECT gcm.group_chat_id FROM public.group_chat_members gcm WHERE gcm.user_id = auth.uid()
));

-- Fix the INSERT policy for group_chat_messages to avoid recursion through group_chat_members
DROP POLICY IF EXISTS "Group members can send messages" ON public.group_chat_messages;
CREATE POLICY "Group members can send messages"
ON public.group_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.group_chat_members gcm
    WHERE gcm.group_chat_id = group_chat_messages.group_chat_id
      AND gcm.user_id = auth.uid()
  )
);

-- Fix the SELECT policy for group_chat_messages similarly
DROP POLICY IF EXISTS "Group members can view messages" ON public.group_chat_messages;
CREATE POLICY "Group members can view messages"
ON public.group_chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_chat_members gcm
    WHERE gcm.group_chat_id = group_chat_messages.group_chat_id
      AND gcm.user_id = auth.uid()
  )
);

-- Add avatar_url column to group_chats for customization
ALTER TABLE public.group_chats ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow group creator to update group chat (name, avatar)
CREATE POLICY "Creator can update group chats"
ON public.group_chats
FOR UPDATE
USING (auth.uid() = created_by);
