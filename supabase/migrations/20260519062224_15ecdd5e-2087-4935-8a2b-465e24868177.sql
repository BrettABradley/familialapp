
-- 1. Add email preference columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_on_mention boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_on_unread_dm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_on_new_album boolean NOT NULL DEFAULT true;

-- 2. Pending unread email digest tracking (DMs only for now)
CREATE TABLE IF NOT EXISTS public.pending_unread_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  first_unread_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, sender_id)
);

ALTER TABLE public.pending_unread_email_notifications ENABLE ROW LEVEL SECURITY;

-- No client policies — service role only via edge functions

CREATE INDEX IF NOT EXISTS idx_pending_unread_due
  ON public.pending_unread_email_notifications (first_unread_at)
  WHERE email_sent_at IS NULL;

-- 3. Trigger: after a DM is inserted, upsert a pending row for the recipient
CREATE OR REPLACE FUNCTION public.track_unread_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pending_unread_email_notifications
    (recipient_id, sender_id, first_unread_at, last_message_at)
  VALUES (NEW.recipient_id, NEW.sender_id, now(), now())
  ON CONFLICT (recipient_id, sender_id)
  DO UPDATE SET last_message_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_unread_dm ON public.private_messages;
CREATE TRIGGER trg_track_unread_dm
AFTER INSERT ON public.private_messages
FOR EACH ROW EXECUTE FUNCTION public.track_unread_dm();

-- 4. Trigger: when DM is marked read, delete pending row
CREATE OR REPLACE FUNCTION public.clear_unread_dm_on_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    DELETE FROM public.pending_unread_email_notifications
    WHERE recipient_id = NEW.recipient_id
      AND sender_id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_unread_dm_on_read ON public.private_messages;
CREATE TRIGGER trg_clear_unread_dm_on_read
AFTER UPDATE OF is_read ON public.private_messages
FOR EACH ROW EXECUTE FUNCTION public.clear_unread_dm_on_read();
