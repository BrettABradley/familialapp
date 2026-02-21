CREATE POLICY "Invited users can view circle info"
  ON public.circles FOR SELECT
  USING (
    id IN (
      SELECT ci.circle_id FROM public.circle_invites ci
      WHERE ci.email = (auth.jwt() ->> 'email')
        AND ci.status = 'pending'
        AND ci.expires_at > now()
    )
  );