
-- Fix user_plans defaults to match Free tier
ALTER TABLE public.user_plans ALTER COLUMN max_circles SET DEFAULT 3;

-- Update handle_new_user to also create a user_plans row
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
  VALUES (NEW.id, 'free', 3, 8)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Backfill: create user_plans rows for existing users who don't have one
INSERT INTO public.user_plans (user_id, plan, max_circles, max_members_per_circle)
SELECT p.user_id, 'free', 3, 8
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_plans up WHERE up.user_id = p.user_id);

-- Create transfer_circle_ownership function
CREATE OR REPLACE FUNCTION public.transfer_circle_ownership(_circle_id uuid, _new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Remove new owner from memberships (owners are implicit members)
  DELETE FROM circle_memberships WHERE circle_id = _circle_id AND user_id = _new_owner_id;
  
  -- Add old owner as admin member
  INSERT INTO circle_memberships (circle_id, user_id, role) VALUES (_circle_id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;
END;
$$;
