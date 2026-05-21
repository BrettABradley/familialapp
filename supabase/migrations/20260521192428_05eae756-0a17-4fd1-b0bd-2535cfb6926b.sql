
CREATE OR REPLACE FUNCTION public.delete_private_conversation_as_creator(_other_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _other_user_id IS NULL OR _other_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid conversation';
  END IF;

  -- Either participant may delete the conversation.
  IF NOT EXISTS (
    SELECT 1 FROM public.private_messages
    WHERE (sender_id = auth.uid() AND recipient_id = _other_user_id)
       OR (sender_id = _other_user_id AND recipient_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  DELETE FROM public.private_messages
  WHERE (sender_id = auth.uid() AND recipient_id = _other_user_id)
     OR (sender_id = _other_user_id AND recipient_id = auth.uid());
END;
$function$;
