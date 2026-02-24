
-- Fix all circle_invites policies to be permissive

-- SELECT policies
DROP POLICY IF EXISTS "Invited users can view their pending invites" ON circle_invites;
CREATE POLICY "Invited users can view their pending invites"
ON circle_invites FOR SELECT TO authenticated
USING ((email = (auth.jwt() ->> 'email'::text)) AND (status = 'pending'::text));

DROP POLICY IF EXISTS "Users can view invites they sent" ON circle_invites;
CREATE POLICY "Users can view invites they sent"
ON circle_invites FOR SELECT TO authenticated
USING (auth.uid() = invited_by);

-- UPDATE policy
DROP POLICY IF EXISTS "Invited users can respond to their invites" ON circle_invites;
CREATE POLICY "Invited users can respond to their invites"
ON circle_invites FOR UPDATE TO authenticated
USING ((email = (auth.jwt() ->> 'email'::text)) AND (status = 'pending'::text))
WITH CHECK ((email = (auth.jwt() ->> 'email'::text)) AND (status = ANY (ARRAY['accepted'::text, 'declined'::text])));

-- INSERT policy
DROP POLICY IF EXISTS "Circle members can create invites" ON circle_invites;
CREATE POLICY "Circle members can create invites"
ON circle_invites FOR INSERT TO authenticated
WITH CHECK (is_circle_member(auth.uid(), circle_id));
