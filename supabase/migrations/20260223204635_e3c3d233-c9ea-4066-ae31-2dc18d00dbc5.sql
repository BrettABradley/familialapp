
-- Add pending_plan column to user_plans
ALTER TABLE public.user_plans ADD COLUMN IF NOT EXISTS pending_plan text DEFAULT null;

-- Create circle_rescue_offers table
CREATE TABLE public.circle_rescue_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  current_owner uuid NOT NULL,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  claimed_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.circle_rescue_offers ENABLE ROW LEVEL SECURITY;

-- SELECT: circle members can view rescue offers for their circles
CREATE POLICY "Circle members can view rescue offers"
  ON public.circle_rescue_offers
  FOR SELECT
  TO authenticated
  USING (
    circle_id IN (
      SELECT cm.circle_id FROM public.circle_memberships cm WHERE cm.user_id = auth.uid()
    )
    OR circle_id IN (
      SELECT c.id FROM public.circles c WHERE c.owner_id = auth.uid()
    )
  );

-- INSERT: only service role / edge functions will insert, but allow current_owner to insert
CREATE POLICY "Owners can create rescue offers"
  ON public.circle_rescue_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (current_owner = auth.uid());

-- UPDATE: authenticated members can claim
CREATE POLICY "Members can claim rescue offers"
  ON public.circle_rescue_offers
  FOR UPDATE
  TO authenticated
  USING (
    status = 'open'
    AND (
      circle_id IN (
        SELECT cm.circle_id FROM public.circle_memberships cm WHERE cm.user_id = auth.uid()
      )
      OR circle_id IN (
        SELECT c.id FROM public.circles c WHERE c.owner_id = auth.uid()
      )
    )
  );
