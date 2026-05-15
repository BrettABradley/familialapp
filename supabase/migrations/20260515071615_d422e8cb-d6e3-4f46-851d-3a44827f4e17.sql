-- 1) Add timestamp column
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS transfer_block_started_at timestamptz;

-- Backfill: any circle currently on transfer block starts its 45-day countdown now
UPDATE public.circles
SET transfer_block_started_at = now()
WHERE transfer_block = true AND transfer_block_started_at IS NULL;

-- 2) Trigger to auto-set/clear the timestamp when transfer_block flips
CREATE OR REPLACE FUNCTION public.set_transfer_block_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transfer_block = true AND (OLD.transfer_block IS DISTINCT FROM true) THEN
    NEW.transfer_block_started_at := now();
  ELSIF NEW.transfer_block = false AND OLD.transfer_block = true THEN
    NEW.transfer_block_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_transfer_block_timestamp_trigger ON public.circles;
CREATE TRIGGER set_transfer_block_timestamp_trigger
BEFORE UPDATE ON public.circles
FOR EACH ROW
EXECUTE FUNCTION public.set_transfer_block_timestamp();

-- 3) Allow the original owner to reclaim their own circle while on transfer block
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
  v_max_members integer;
  v_circle_extra integer;
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

  -- Caller must be a member (owners are already considered members for this purpose)
  IF NOT v_is_reclaim AND NOT EXISTS (
    SELECT 1 FROM circle_memberships WHERE circle_id = _circle_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You must be a member of the circle to claim ownership';
  END IF;

  -- Plan checks only apply to NEW owners reclaiming counts toward an extra circle.
  -- The original owner reclaiming doesn't add a new circle to their count.
  IF NOT v_is_reclaim THEN
    SELECT COUNT(*) INTO v_circle_count FROM circles WHERE owner_id = auth.uid();
    SELECT COALESCE(max_circles, 1) INTO v_max_circles FROM user_plans WHERE user_id = auth.uid();
    IF v_max_circles IS NULL THEN v_max_circles := 1; END IF;
    IF v_circle_count >= v_max_circles THEN
      RAISE EXCEPTION 'CIRCLE_LIMIT_REACHED';
    END IF;

    SELECT COUNT(*) INTO v_member_count FROM circle_memberships WHERE circle_id = _circle_id;
    SELECT COALESCE(max_members_per_circle, 8) INTO v_max_members FROM user_plans WHERE user_id = auth.uid();
    IF v_max_members IS NULL THEN v_max_members := 8; END IF;
    SELECT COALESCE(extra_members, 0) INTO v_circle_extra FROM circles WHERE id = _circle_id;
    IF v_member_count > (v_max_members + v_circle_extra - 1) THEN
      RAISE EXCEPTION 'PLAN_TOO_LOW';
    END IF;
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

-- 4) Forfeiture function — wipes circles whose transfer block has been active for 45+ days
CREATE OR REPLACE FUNCTION public.forfeit_stale_transfer_blocks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_circle record;
  v_count integer := 0;
BEGIN
  FOR v_circle IN
    SELECT id, owner_id, name
    FROM circles
    WHERE transfer_block = true
      AND transfer_block_started_at IS NOT NULL
      AND transfer_block_started_at < (now() - interval '45 days')
  LOOP
    -- Notify former owner that the circle was forfeited
    INSERT INTO notifications (user_id, type, title, message, related_circle_id)
    VALUES (
      v_circle.owner_id,
      'circle_forfeited',
      'Circle Forfeited',
      '"' || v_circle.name || '" was on transfer block for 45 days with no claim and has been permanently deleted.',
      NULL
    );

    -- Delete dependent data
    DELETE FROM campfire_stories WHERE fridge_pin_id IN (SELECT id FROM fridge_pins WHERE circle_id = v_circle.id);
    DELETE FROM fridge_pins WHERE circle_id = v_circle.id;

    DELETE FROM album_photos WHERE album_id IN (SELECT id FROM photo_albums WHERE circle_id = v_circle.id);
    DELETE FROM photo_albums WHERE circle_id = v_circle.id;

    DELETE FROM event_rsvps WHERE event_id IN (SELECT id FROM events WHERE circle_id = v_circle.id);
    DELETE FROM events WHERE circle_id = v_circle.id;

    DELETE FROM group_chat_messages WHERE group_chat_id IN (SELECT id FROM group_chats WHERE circle_id = v_circle.id);
    DELETE FROM group_chat_members WHERE group_chat_id IN (SELECT id FROM group_chats WHERE circle_id = v_circle.id);
    DELETE FROM group_chats WHERE circle_id = v_circle.id;

    DELETE FROM reactions WHERE post_id IN (SELECT id FROM posts WHERE circle_id = v_circle.id);
    DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE circle_id = v_circle.id);
    DELETE FROM photo_permissions WHERE post_id IN (SELECT id FROM posts WHERE circle_id = v_circle.id);
    DELETE FROM posts WHERE circle_id = v_circle.id;

    DELETE FROM family_tree_members WHERE circle_id = v_circle.id;
    DELETE FROM member_aliases WHERE circle_id = v_circle.id;
    DELETE FROM circle_invites WHERE circle_id = v_circle.id;
    DELETE FROM circle_rescue_offers WHERE circle_id = v_circle.id;
    DELETE FROM user_roles WHERE circle_id = v_circle.id;
    DELETE FROM circle_memberships WHERE circle_id = v_circle.id;
    DELETE FROM circles WHERE id = v_circle.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5) Schedule the forfeiture sweep daily at 3am UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'forfeit-stale-transfer-blocks-daily') THEN
    PERFORM cron.unschedule('forfeit-stale-transfer-blocks-daily');
  END IF;
  PERFORM cron.schedule(
    'forfeit-stale-transfer-blocks-daily',
    '0 3 * * *',
    $cron$ SELECT public.forfeit_stale_transfer_blocks(); $cron$
  );
END;
$$;