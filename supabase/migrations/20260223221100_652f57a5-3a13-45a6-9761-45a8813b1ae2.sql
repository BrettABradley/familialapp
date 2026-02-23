
-- RPC for claiming ownership when transfer_block is true
CREATE OR REPLACE FUNCTION public.claim_circle_ownership(_circle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Transfer ownership
  UPDATE circles SET owner_id = auth.uid(), transfer_block = false WHERE id = _circle_id;

  -- Remove new owner from memberships (owners are implicit members)
  DELETE FROM circle_memberships WHERE circle_id = _circle_id AND user_id = auth.uid();

  -- Add old owner as admin member
  INSERT INTO circle_memberships (circle_id, user_id, role) VALUES (_circle_id, v_old_owner, 'admin')
  ON CONFLICT DO NOTHING;
END;
$$;
