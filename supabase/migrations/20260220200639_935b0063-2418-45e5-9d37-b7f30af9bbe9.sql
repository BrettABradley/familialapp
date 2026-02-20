
-- Task 1: Update can_create_circle to default max_circles to 3
CREATE OR REPLACE FUNCTION public.can_create_circle(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(
    (SELECT max_circles FROM public.user_plans WHERE user_id = _user_id),
    3
  ) INTO v_limit;

  SELECT COUNT(*)
  FROM public.circles
  WHERE owner_id = _user_id
  INTO v_count;

  RETURN v_count < v_limit;
END;
$function$;

-- Also update get_circle_limit to match
CREATE OR REPLACE FUNCTION public.get_circle_limit()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT max_circles FROM public.user_plans WHERE user_id = auth.uid()), 3);
$function$;

-- Task 2: Add FK constraint for circle_memberships.user_id -> profiles.user_id
ALTER TABLE public.circle_memberships
  ADD CONSTRAINT circle_memberships_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Task 2: Add FK constraint for fridge_pins.pinned_by -> profiles.user_id
ALTER TABLE public.fridge_pins
  ADD CONSTRAINT fridge_pins_pinned_by_profiles_fkey
  FOREIGN KEY (pinned_by) REFERENCES public.profiles(user_id);

-- Task 4: Enable realtime on private_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
