DROP POLICY IF EXISTS "Users can only subscribe to their own private-messages topic" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can subscribe to allowed topics" ON realtime.messages;

CREATE POLICY "authenticated topic allowlist" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() = 'private-messages:' || auth.uid()::text
  OR realtime.topic() = 'group-messages:' || auth.uid()::text
  OR realtime.topic() LIKE 'bell-' || auth.uid()::text || '-%'
);