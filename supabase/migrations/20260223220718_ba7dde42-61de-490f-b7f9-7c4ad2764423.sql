
-- 1. Transfer requests table
CREATE TABLE public.circle_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  leave_after_transfer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.circle_transfer_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Participants can view transfer requests"
  ON public.circle_transfer_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Circle owners can create transfer requests"
  ON public.circle_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Recipients can respond to transfer requests"
  ON public.circle_transfer_requests FOR UPDATE TO authenticated
  USING (auth.uid() = to_user_id AND status = 'pending');

CREATE POLICY "Senders can cancel transfer requests"
  ON public.circle_transfer_requests FOR DELETE TO authenticated
  USING (auth.uid() = from_user_id AND status = 'pending');

-- 2. Transfer block column on circles
ALTER TABLE public.circles ADD COLUMN transfer_block boolean NOT NULL DEFAULT false;
