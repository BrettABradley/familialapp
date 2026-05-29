
-- ============================================================
-- Fix #2: Block circle members from overwriting owner_id and other columns
-- ============================================================
DROP POLICY IF EXISTS "Members can update circle avatar" ON public.circles;

CREATE OR REPLACE FUNCTION public.update_circle_avatar(_circle_id uuid, _avatar_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_circle_member(auth.uid(), _circle_id) THEN
    RAISE EXCEPTION 'Not authorized to update this circle';
  END IF;

  UPDATE public.circles
  SET avatar_url = _avatar_url,
      updated_at = now()
  WHERE id = _circle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_circle_avatar(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_circle_avatar(uuid, text) TO authenticated;

-- ============================================================
-- Fix #1: Replace SELECT policy on circle_invites with SECURITY DEFINER function
-- ============================================================
DROP POLICY IF EXISTS "Invited users can view their pending invites" ON public.circle_invites;

CREATE OR REPLACE FUNCTION public.get_my_pending_invites()
RETURNS TABLE (
  id uuid,
  circle_id uuid,
  invited_by uuid,
  email text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  circle_name text,
  circle_description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ci.id,
    ci.circle_id,
    ci.invited_by,
    ci.email,
    ci.status,
    ci.created_at,
    ci.expires_at,
    c.name AS circle_name,
    c.description AS circle_description
  FROM public.circle_invites ci
  JOIN public.circles c ON c.id = ci.circle_id
  WHERE ci.email = (auth.jwt() ->> 'email')
    AND ci.status = 'pending'
    AND ci.expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_invites() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_pending_invites() TO authenticated;
