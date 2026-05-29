
-- Fix 1: Hide circle_invites.token from authenticated clients via column-level grants.
-- The existing RLS predicate (email = JWT email AND status=pending) still gates rows,
-- but column-level grants now prevent SELECTing the token at all.
REVOKE SELECT ON public.circle_invites FROM authenticated;
GRANT SELECT (id, circle_id, invited_by, email, status, created_at, expires_at)
  ON public.circle_invites TO authenticated;

-- Fix 2: Scope Realtime channel subscriptions to the subscribing user.
-- Client now subscribes to `private-messages:<uid>` and `group-messages:<uid>`.
-- Only allow subscription when the topic ends with the user's own auth.uid().
CREATE POLICY "Users can only subscribe to their own private-messages topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'private-messages:%'
        THEN realtime.topic() = 'private-messages:' || auth.uid()::text
      WHEN realtime.topic() LIKE 'group-messages:%'
        THEN realtime.topic() = 'group-messages:' || auth.uid()::text
      ELSE true
    END
  );
