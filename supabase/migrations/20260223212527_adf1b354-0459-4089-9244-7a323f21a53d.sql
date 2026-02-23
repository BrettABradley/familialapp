
-- 1. Update any moderator rows to member
UPDATE public.user_roles SET role = 'member' WHERE role = 'moderator';
UPDATE public.circle_memberships SET role = 'member' WHERE role = 'moderator';

-- 2. Drop function that depends on enum
DROP FUNCTION IF EXISTS public.has_circle_role(uuid, uuid, public.app_role);

-- 3. Recreate app_role enum without moderator
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'member';
DROP TYPE public.app_role_old;

-- 4. Recreate has_circle_role function
CREATE OR REPLACE FUNCTION public.has_circle_role(_user_id uuid, _circle_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND circle_id = _circle_id
      AND role = _role
  )
$$;

-- 5. Update fridge_pins RLS policies
DROP POLICY "Admins can create fridge pins" ON public.fridge_pins;
CREATE POLICY "Members can create fridge pins" ON public.fridge_pins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = pinned_by AND is_circle_member(auth.uid(), circle_id));

DROP POLICY "Admins can delete fridge pins" ON public.fridge_pins;
CREATE POLICY "Members can delete own or admin can delete" ON public.fridge_pins
  FOR DELETE TO authenticated
  USING (auth.uid() = pinned_by OR is_circle_admin(auth.uid(), circle_id));

DROP POLICY "Admins can update fridge pins" ON public.fridge_pins;
CREATE POLICY "Members can update own or admin can update" ON public.fridge_pins
  FOR UPDATE TO authenticated
  USING (auth.uid() = pinned_by OR is_circle_admin(auth.uid(), circle_id));

-- 6. Update circle_invites INSERT policy
DROP POLICY "Circle admins can create invites" ON public.circle_invites;
CREATE POLICY "Circle members can create invites" ON public.circle_invites
  FOR INSERT TO authenticated
  WITH CHECK (is_circle_member(auth.uid(), circle_id));
