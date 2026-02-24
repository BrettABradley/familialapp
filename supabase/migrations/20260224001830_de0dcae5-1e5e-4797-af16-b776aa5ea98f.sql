
-- Drop the restrictive UPDATE policy and recreate as permissive
DROP POLICY IF EXISTS "Invited users can respond to their invites" ON circle_invites;

CREATE POLICY "Invited users can respond to their invites"
ON circle_invites
FOR UPDATE
TO authenticated
USING (
  (email = (auth.jwt() ->> 'email'::text)) AND (status = 'pending'::text)
)
WITH CHECK (
  (email = (auth.jwt() ->> 'email'::text)) AND (status = ANY (ARRAY['accepted'::text, 'declined'::text]))
);
