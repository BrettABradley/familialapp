
-- Create RSVP table for events
CREATE TABLE public.event_rsvps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'going',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id),
  CONSTRAINT valid_rsvp_status CHECK (status IN ('going', 'maybe', 'not_going'))
);

-- Enable RLS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Circle members can view RSVPs for events in their circles
CREATE POLICY "Circle members can view event RSVPs"
ON public.event_rsvps FOR SELECT
USING (
  event_id IN (
    SELECT e.id FROM events e
    WHERE e.circle_id IN (
      SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid()
    ) OR e.circle_id IN (
      SELECT id FROM circles WHERE owner_id = auth.uid()
    )
  )
);

-- Users can RSVP to events in their circles
CREATE POLICY "Users can RSVP to events"
ON public.event_rsvps FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND event_id IN (
    SELECT e.id FROM events e
    WHERE e.circle_id IN (
      SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid()
    ) OR e.circle_id IN (
      SELECT id FROM circles WHERE owner_id = auth.uid()
    )
  )
);

-- Users can update their own RSVP
CREATE POLICY "Users can update own RSVP"
ON public.event_rsvps FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own RSVP
CREATE POLICY "Users can delete own RSVP"
ON public.event_rsvps FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_event_rsvps_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_event_rsvps_event_id ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user_id ON public.event_rsvps(user_id);
