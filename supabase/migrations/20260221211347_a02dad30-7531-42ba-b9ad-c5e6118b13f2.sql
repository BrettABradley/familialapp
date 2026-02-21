-- Fix free tier default to 1 circle
ALTER TABLE public.user_plans ALTER COLUMN max_circles SET DEFAULT 1;

-- Update handle_new_user to create free plan with 1 circle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_plans (user_id, plan, max_circles, max_members_per_circle)
  VALUES (NEW.id, 'free', 1, 8)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Update can_create_circle default fallback from 3 to 1
CREATE OR REPLACE FUNCTION public.can_create_circle(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(
    (SELECT max_circles FROM public.user_plans WHERE user_id = _user_id),
    1
  ) INTO v_limit;

  SELECT COUNT(*)
  FROM public.circles
  WHERE owner_id = _user_id
  INTO v_count;

  RETURN v_count < v_limit;
END;
$$;

-- Update get_circle_limit default fallback from 3 to 1
CREATE OR REPLACE FUNCTION public.get_circle_limit()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT max_circles FROM public.user_plans WHERE user_id = auth.uid()), 1);
$$;

-- Fix existing free-tier users: set max_circles to 1
UPDATE public.user_plans SET max_circles = 1 WHERE plan = 'free';