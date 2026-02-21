
-- 1. Trigger function: auto-join circles on signup
CREATE OR REPLACE FUNCTION public.handle_invite_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add user as member to all circles they were invited to
  INSERT INTO public.circle_memberships (circle_id, user_id, role)
  SELECT ci.circle_id, NEW.id, 'member'
  FROM public.circle_invites ci
  WHERE ci.email = NEW.email
    AND ci.status = 'pending'
    AND ci.expires_at > now()
  ON CONFLICT DO NOTHING;

  -- Mark those invites as accepted
  UPDATE public.circle_invites
  SET status = 'accepted'
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invite_on_signup();

-- 3. Add unique constraint on circle_memberships to support ON CONFLICT
ALTER TABLE public.circle_memberships
  ADD CONSTRAINT circle_memberships_circle_user_unique UNIQUE (circle_id, user_id);

-- 4. RLS: Allow invited users to read their own pending invites (by email match via auth.jwt())
CREATE POLICY "Invited users can view their pending invites"
  ON public.circle_invites
  FOR SELECT
  USING (
    email = (auth.jwt() ->> 'email')
    AND status = 'pending'
  );

-- 5. RLS: Allow invited users to update their own invites to accepted
CREATE POLICY "Invited users can accept their invites"
  ON public.circle_invites
  FOR UPDATE
  USING (
    email = (auth.jwt() ->> 'email')
    AND status = 'pending'
  );

-- 6. RLS: Allow users to self-join a circle if they have a valid pending invite
CREATE POLICY "Users can join via invite"
  ON public.circle_memberships
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.circle_invites ci
      WHERE ci.circle_id = circle_memberships.circle_id
        AND ci.email = (auth.jwt() ->> 'email')
        AND ci.status = 'pending'
        AND ci.expires_at > now()
    )
  );

-- 7. RLS: Allow admins to update member roles
CREATE POLICY "Circle admins can update member roles"
  ON public.circle_memberships
  FOR UPDATE
  USING (is_circle_admin(auth.uid(), circle_id));
