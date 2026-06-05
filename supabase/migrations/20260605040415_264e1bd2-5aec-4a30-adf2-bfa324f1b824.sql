-- 1. circle_invites: explicit SELECT policy (scoped to inviter, admin, invitee)
CREATE POLICY "Invite participants can read invites"
  ON public.circle_invites
  FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR public.is_circle_admin(auth.uid(), circle_id)
    OR (email = (auth.jwt() ->> 'email') AND status = 'pending' AND expires_at > now())
  );

-- 2. google_play_events: explicit service-role-only policy
CREATE POLICY "Service role only"
  ON public.google_play_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);