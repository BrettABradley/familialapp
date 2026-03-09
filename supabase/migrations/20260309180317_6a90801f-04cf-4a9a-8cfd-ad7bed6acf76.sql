
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

  SELECT c.id, c.name INTO v_circle_id, v_circle_name
  FROM circles c
  WHERE c.invite_code = _invite_code
  LIMIT 1;

  IF v_circle_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF EXISTS (SELECT 1 FROM circles WHERE id = v_circle_id AND owner_id = v_caller) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;

  IF EXISTS (SELECT 1 FROM circle_memberships cm WHERE cm.circle_id = v_circle_id AND cm.user_id = v_caller) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;

  INSERT INTO circle_memberships (circle_id, user_id, role)
  VALUES (v_circle_id, v_caller, 'member');

  circle_id := v_circle_id;
  circle_name := v_circle_name;
  RETURN NEXT;
END;
$$;
