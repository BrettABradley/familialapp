-- Fix: the UPDATE policy implicitly uses USING as WITH CHECK too,
-- which rejects the row after status changes from 'pending'.
-- Drop and recreate with explicit WITH CHECK allowing the new status values.

DROP POLICY "Invited users can accept their invites" ON public.circle_invites;

CREATE POLICY "Invited users can respond to their invites"
  ON public.circle_invites FOR UPDATE
  USING (
    email = (auth.jwt() ->> 'email') AND status = 'pending'
  )
  WITH CHECK (
    email = (auth.jwt() ->> 'email') AND status IN ('accepted', 'declined')
  );

-- Add invite_code column to circles for shareable join codes
ALTER TABLE public.circles
  ADD COLUMN invite_code text UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

-- Backfill existing circles that got NULL
UPDATE public.circles
  SET invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  WHERE invite_code IS NULL;

-- Make it NOT NULL going forward
ALTER TABLE public.circles
  ALTER COLUMN invite_code SET NOT NULL;