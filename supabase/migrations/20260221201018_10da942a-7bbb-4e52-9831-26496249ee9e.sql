
-- Allow authenticated users to look up a circle by invite code
CREATE POLICY "Users can look up circles by invite code"
  ON public.circles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to self-join a circle (for join-by-code flow)
CREATE POLICY "Users can join via invite code"
  ON public.circle_memberships FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = circle_memberships.circle_id
    )
  );
