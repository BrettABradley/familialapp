
-- Create a SECURITY DEFINER function to check group membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_group_chat_member(_user_id uuid, _group_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_chat_members
    WHERE user_id = _user_id AND group_chat_id = _group_chat_id
  );
$$;

-- Fix group_chat_members SELECT policy using the function
DROP POLICY IF EXISTS "Members can view group chat members" ON public.group_chat_members;
CREATE POLICY "Members can view group chat members"
ON public.group_chat_members
FOR SELECT
USING (is_group_chat_member(auth.uid(), group_chat_id));

-- Fix group_chat_messages policies using the function
DROP POLICY IF EXISTS "Group members can send messages" ON public.group_chat_messages;
CREATE POLICY "Group members can send messages"
ON public.group_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND is_group_chat_member(auth.uid(), group_chat_id)
);

DROP POLICY IF EXISTS "Group members can view messages" ON public.group_chat_messages;
CREATE POLICY "Group members can view messages"
ON public.group_chat_messages
FOR SELECT
USING (is_group_chat_member(auth.uid(), group_chat_id));
