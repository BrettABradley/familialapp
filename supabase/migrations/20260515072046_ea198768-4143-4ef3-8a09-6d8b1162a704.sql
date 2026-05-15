CREATE OR REPLACE FUNCTION public.claim_circle_ownership(_circle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_owner uuid;
  v_circle_count integer;
  v_max_circles integer;
  v_member_count integer;
  v_claimer_max_members integer;
  v_required_tier_capacity integer;
  v_is_reclaim boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_old_owner
  FROM circles
  WHERE id = _circle_id AND transfer_block = true;

  IF v_old_owner IS NULL THEN
    RAISE EXCEPTION 'Circle is not on transfer block';
  END IF;

  IF v_old_owner = auth.uid() THEN
    v_is_reclaim := true;
  END IF;

  -- Caller must be a member (or original owner reclaiming)
  IF NOT v_is_reclaim AND NOT EXISTS (
    SELECT 1 FROM circle_memberships WHERE circle_id = _circle_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You must be a member of the circle to claim ownership';
  END IF;

  -- Circle-count limit ALWAYS applies (closes the "make new account, then reclaim" loophole).
  -- For reclaim, the user previously owned this circle but currently does not, so the count
  -- correctly reflects circles they own RIGHT NOW.
  SELECT COUNT(*) INTO v_circle_count FROM circles WHERE owner_id = auth.uid();
  SELECT COALESCE(max_circles, 1) INTO v_max_circles FROM user_plans WHERE user_id = auth.uid();
  IF v_max_circles IS NULL THEN v_max_circles := 1; END IF;
  IF v_circle_count >= v_max_circles THEN
    RAISE EXCEPTION 'CIRCLE_LIMIT_REACHED';
  END IF;

  -- Subscription tier check (applies to BOTH reclaim and new claim).
  -- Determine the tier capacity required to host the current member count,
  -- IGNORING per-circle extra_members (those are à la carte add-ons that
  -- should not raise the tier requirement).
  SELECT COUNT(*) INTO v_member_count FROM circle_memberships WHERE circle_id = _circle_id;

  IF v_member_count <= 8 THEN
    v_required_tier_capacity := 8;   -- Free tier OK
  ELSIF v_member_count <= 20 THEN
    v_required_tier_capacity := 20;  -- Family tier required
  ELSE
    v_required_tier_capacity := 35;  -- Extended tier required
  END IF;

  SELECT COALESCE(max_members_per_circle, 8) INTO v_claimer_max_members
  FROM user_plans WHERE user_id = auth.uid();
  IF v_claimer_max_members IS NULL THEN v_claimer_max_members := 8; END IF;

  IF v_claimer_max_members < v_required_tier_capacity THEN
    RAISE EXCEPTION 'PLAN_TOO_LOW';
  END IF;

  -- Transfer ownership and clear transfer block (timestamp cleared by BEFORE trigger)
  UPDATE circles SET owner_id = auth.uid(), transfer_block = false WHERE id = _circle_id;

  INSERT INTO circle_memberships (circle_id, user_id, role)
  VALUES (_circle_id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  IF NOT v_is_reclaim THEN
    INSERT INTO circle_memberships (circle_id, user_id, role)
    VALUES (_circle_id, v_old_owner, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$function$;