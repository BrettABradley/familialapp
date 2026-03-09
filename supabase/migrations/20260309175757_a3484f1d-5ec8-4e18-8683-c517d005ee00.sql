
CREATE OR REPLACE FUNCTION public.join_circle_by_invite_code(_invite_code text)
RETURNS TABLE(circle_id uuid, circle_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_circle_id uuid;
  v_circle_name text;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up circle by invite code
  SELECT c.id, c.name INTO v_circle_id, v_circle_name
  FROM circles c
  WHERE c.invite_code = _invite_code
  LIMIT 1;

  IF v_circle_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if already owner
  IF EXISTS (SELECT 1 FROM circles WHERE id = v_circle_id AND owner_id = v_caller) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id = v_circle_id AND user_id = v_caller) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;

  -- Insert membership (the enforce_circle_member_limit trigger will check capacity)
  INSERT INTO circle_memberships (circle_id, user_id, role)
  VALUES (v_circle_id, v_caller, 'member');

  RETURN QUERY SELECT v_circle_id, v_circle_name;
END;
$$;
