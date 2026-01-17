-- Fix infinite recursion in RLS policies for public.circle_memberships
-- Root cause: policies queried circle_memberships inside circle_memberships policies.

-- 1) Helper: membership check executed as SECURITY DEFINER to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_circle_member(_user_id uuid, _circle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM public.circles c WHERE c.id = _circle_id AND c.owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.circle_memberships m WHERE m.circle_id = _circle_id AND m.user_id = _user_id)
  );
$$;

-- 2) Replace recursive policies
DO $$
BEGIN
  -- Drop old policies if present
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_memberships' AND policyname='Circle owners/admins can add members') THEN
    DROP POLICY "Circle owners/admins can add members" ON public.circle_memberships;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_memberships' AND policyname='Members can view circle memberships') THEN
    DROP POLICY "Members can view circle memberships" ON public.circle_memberships;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='circle_memberships' AND policyname='Circle owners/admins can remove members') THEN
    DROP POLICY "Circle owners/admins can remove members" ON public.circle_memberships;
  END IF;
END
$$;

-- SELECT: any member (or owner) can view memberships for circles they belong to
CREATE POLICY "Members can view circle memberships"
ON public.circle_memberships
FOR SELECT
USING (public.is_circle_member(auth.uid(), circle_id));

-- INSERT: only circle admins/owners can add members (used during circle creation too)
CREATE POLICY "Circle owners/admins can add members"
ON public.circle_memberships
FOR INSERT
WITH CHECK (public.is_circle_admin(auth.uid(), circle_id));

-- DELETE: admins can remove; users can remove themselves
CREATE POLICY "Circle owners/admins can remove members"
ON public.circle_memberships
FOR DELETE
USING (public.is_circle_admin(auth.uid(), circle_id) OR user_id = auth.uid());
