
CREATE OR REPLACE FUNCTION public.leave_group_chat(_group_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.group_chat_members
  WHERE group_chat_id = _group_chat_id
    AND user_id = auth.uid();

  SELECT COUNT(*) INTO v_remaining
  FROM public.group_chat_members
  WHERE group_chat_id = _group_chat_id;

  IF v_remaining = 0 THEN
    DELETE FROM public.group_chat_messages WHERE group_chat_id = _group_chat_id;
    DELETE FROM public.group_chats WHERE id = _group_chat_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_group_chat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_circle_invite(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_email FROM public.circle_invites WHERE id = _invite_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF lower(v_email) <> lower(COALESCE(v_user_email, '')) THEN
    RAISE EXCEPTION 'Not authorized to decline this invite';
  END IF;

  UPDATE public.circle_invites
  SET status = 'declined'
  WHERE id = _invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_circle_invite(uuid) TO authenticated;
