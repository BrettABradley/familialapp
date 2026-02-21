
-- Add extra_members column to user_plans
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS extra_members integer NOT NULL DEFAULT 0;

-- Also allow any circle member to read the circle owner's plan (needed for limit checks)
CREATE POLICY "Circle members can view circle owner plan"
ON public.user_plans
FOR SELECT
USING (
  user_id IN (
    SELECT c.owner_id FROM public.circles c
    WHERE c.id IN (
      SELECT cm.circle_id FROM public.circle_memberships cm WHERE cm.user_id = auth.uid()
    )
    OR c.owner_id = auth.uid()
  )
);

-- Create enforcement trigger function
CREATE OR REPLACE FUNCTION public.enforce_circle_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_max_members integer;
  v_extra integer;
  v_current_count integer;
BEGIN
  -- Get the circle owner
  SELECT owner_id INTO v_owner_id
  FROM public.circles
  WHERE id = NEW.circle_id;

  -- Don't count if user is the owner (shouldn't happen but safety)
  IF NEW.user_id = v_owner_id THEN
    RETURN NEW;
  END IF;

  -- Get plan limits
  SELECT COALESCE(max_members_per_circle, 8), COALESCE(extra_members, 0)
  INTO v_max_members, v_extra
  FROM public.user_plans
  WHERE user_id = v_owner_id;

  -- Default if no plan row
  IF v_max_members IS NULL THEN
    v_max_members := 8;
    v_extra := 0;
  END IF;

  -- Count current members (excluding owner, who is implicit)
  SELECT COUNT(*) INTO v_current_count
  FROM public.circle_memberships
  WHERE circle_id = NEW.circle_id;

  -- current_count already excludes owner; limit is total slots minus 1 for owner
  -- Actually: max_members includes the owner, so members (non-owner) allowed = max_members + extra - 1
  IF v_current_count >= (v_max_members + v_extra - 1) THEN
    RAISE EXCEPTION 'Circle has reached its member limit';
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER enforce_member_limit
BEFORE INSERT ON public.circle_memberships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_circle_member_limit();
