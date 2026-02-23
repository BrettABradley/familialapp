
-- Fix claim_circle_ownership: stop removing new owner from memberships
CREATE OR REPLACE FUNCTION public.claim_circle_ownership(_circle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_owner uuid;
BEGIN
  -- Verify circle is on transfer block
  SELECT owner_id INTO v_old_owner
  FROM circles
  WHERE id = _circle_id AND transfer_block = true;

  IF v_old_owner IS NULL THEN
    RAISE EXCEPTION 'Circle is not on transfer block';
  END IF;

  -- Verify caller is a member of the circle
  IF NOT EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id = _circle_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You must be a member of the circle to claim ownership';
  END IF;

  -- Cannot claim if you're already the owner
  IF v_old_owner = auth.uid() THEN
    RAISE EXCEPTION 'You are already the owner';
  END IF;

  -- Transfer ownership and clear transfer block
  UPDATE circles SET owner_id = auth.uid(), transfer_block = false WHERE id = _circle_id;

  -- Keep new owner in circle_memberships (do NOT delete them)

  -- Add old owner as admin member if not already present
  INSERT INTO circle_memberships (circle_id, user_id, role) VALUES (_circle_id, v_old_owner, 'admin')
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Fix transfer_circle_ownership: stop removing new owner from memberships
CREATE OR REPLACE FUNCTION public.transfer_circle_ownership(_circle_id uuid, _new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller is current owner
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = _circle_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the circle owner can transfer ownership';
  END IF;
  
  -- Verify new owner is a member of the circle
  IF NOT EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id = _circle_id AND user_id = _new_owner_id) THEN
    RAISE EXCEPTION 'New owner must be a member of the circle';
  END IF;
  
  -- Transfer ownership
  UPDATE circles SET owner_id = _new_owner_id WHERE id = _circle_id;
  
  -- Keep new owner in circle_memberships (do NOT delete them)
  
  -- Add old owner as admin member
  INSERT INTO circle_memberships (circle_id, user_id, role) VALUES (_circle_id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Fix enforce_circle_member_limit: use per-circle extra_members instead of global
CREATE OR REPLACE FUNCTION public.enforce_circle_member_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_max_members integer;
  v_circle_extra integer;
  v_current_count integer;
BEGIN
  -- Get the circle owner
  SELECT owner_id INTO v_owner_id
  FROM public.circles
  WHERE id = NEW.circle_id;

  -- Don't block if user is the owner
  IF NEW.user_id = v_owner_id THEN
    RETURN NEW;
  END IF;

  -- Get plan base limit
  SELECT COALESCE(max_members_per_circle, 8)
  INTO v_max_members
  FROM public.user_plans
  WHERE user_id = v_owner_id;

  IF v_max_members IS NULL THEN
    v_max_members := 8;
  END IF;

  -- Get per-circle extra members
  SELECT COALESCE(extra_members, 0)
  INTO v_circle_extra
  FROM public.circles
  WHERE id = NEW.circle_id;

  IF v_circle_extra IS NULL THEN
    v_circle_extra := 0;
  END IF;

  -- Count current members
  SELECT COUNT(*) INTO v_current_count
  FROM public.circle_memberships
  WHERE circle_id = NEW.circle_id;

  -- max_members includes owner, so non-owner slots = max_members + circle_extra - 1
  IF v_current_count >= (v_max_members + v_circle_extra - 1) THEN
    RAISE EXCEPTION 'Circle has reached its member limit';
  END IF;

  RETURN NEW;
END;
$function$;
