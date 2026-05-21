CREATE OR REPLACE FUNCTION public.delete_group_chat_as_creator(_group_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_chats
    WHERE id = _group_chat_id
      AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the group chat creator can delete this chat';
  END IF;

  DELETE FROM public.group_chats
  WHERE id = _group_chat_id
    AND created_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_private_conversation_as_creator(_other_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_sender uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _other_user_id IS NULL OR _other_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid conversation';
  END IF;

  SELECT sender_id INTO v_first_sender
  FROM public.private_messages
  WHERE (sender_id = auth.uid() AND recipient_id = _other_user_id)
     OR (sender_id = _other_user_id AND recipient_id = auth.uid())
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_first_sender IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF v_first_sender <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who started this chat can delete it';
  END IF;

  DELETE FROM public.private_messages
  WHERE (sender_id = auth.uid() AND recipient_id = _other_user_id)
     OR (sender_id = _other_user_id AND recipient_id = auth.uid());
END;
$$;