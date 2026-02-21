
-- Allow any circle member to update album cover_photo_url (not just creator/admin)
CREATE POLICY "Circle members can update album cover"
ON public.photo_albums
FOR UPDATE
USING (
  (circle_id IN (
    SELECT circle_memberships.circle_id FROM circle_memberships WHERE circle_memberships.user_id = auth.uid()
  ))
  OR
  (circle_id IN (
    SELECT circles.id FROM circles WHERE circles.owner_id = auth.uid()
  ))
);

-- Group chats table
CREATE TABLE public.group_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can view group chats"
ON public.group_chats FOR SELECT
USING (is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Circle members can create group chats"
ON public.group_chats FOR INSERT
WITH CHECK (auth.uid() = created_by AND is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Creator can delete group chats"
ON public.group_chats FOR DELETE
USING (auth.uid() = created_by);

-- Group chat members table
CREATE TABLE public.group_chat_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_chat_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_chat_id, user_id)
);

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group chat members"
ON public.group_chat_members FOR SELECT
USING (
  group_chat_id IN (
    SELECT gcm.group_chat_id FROM group_chat_members gcm WHERE gcm.user_id = auth.uid()
  )
);

CREATE POLICY "Group creators can add members"
ON public.group_chat_members FOR INSERT
WITH CHECK (
  group_chat_id IN (
    SELECT gc.id FROM group_chats gc WHERE gc.created_by = auth.uid()
  )
  OR auth.uid() = user_id
);

CREATE POLICY "Users can leave group chats"
ON public.group_chat_members FOR DELETE
USING (auth.uid() = user_id);

-- Group chat messages table
CREATE TABLE public.group_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_chat_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view messages"
ON public.group_chat_messages FOR SELECT
USING (
  group_chat_id IN (
    SELECT gcm.group_chat_id FROM group_chat_members gcm WHERE gcm.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send messages"
ON public.group_chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND group_chat_id IN (
    SELECT gcm.group_chat_id FROM group_chat_members gcm WHERE gcm.user_id = auth.uid()
  )
);

CREATE POLICY "Senders can delete own messages"
ON public.group_chat_messages FOR DELETE
USING (auth.uid() = sender_id);

-- Validation trigger for group chat messages
CREATE OR REPLACE FUNCTION public.validate_group_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF length(NEW.content) > 5000 THEN
    RAISE EXCEPTION 'Message must be 5000 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_group_message
BEFORE INSERT ON public.group_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_group_chat_message();

-- Rate limit for group messages
CREATE OR REPLACE FUNCTION public.check_group_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.group_chat_messages
  WHERE sender_id = NEW.sender_id
    AND created_at > NOW() - INTERVAL '1 hour';
  IF recent_count >= 60 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 60 group messages per hour';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_group_msg_rate
BEFORE INSERT ON public.group_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.check_group_message_rate_limit();

-- Enable realtime for group chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages;
