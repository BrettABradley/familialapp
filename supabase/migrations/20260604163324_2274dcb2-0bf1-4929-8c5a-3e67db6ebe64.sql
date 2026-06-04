-- 1. push_tokens: add platform column
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'ios';

ALTER TABLE public.push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_user_id_expo_token_key;

ALTER TABLE public.push_tokens
  ADD CONSTRAINT push_tokens_user_device_platform_key
  UNIQUE (user_id, device_token, platform);

-- 2. user_plans: add Google Play identifiers
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS google_purchase_token text,
  ADD COLUMN IF NOT EXISTS google_subscription_id text;

-- 3. google_play_events: webhook audit log (service-role only)
CREATE TABLE IF NOT EXISTS public.google_play_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type integer,
  subscription_id text,
  purchase_token text,
  package_name text,
  user_id uuid,
  payload jsonb NOT NULL,
  processed_at timestamp with time zone,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_play_events_purchase_token_idx
  ON public.google_play_events (purchase_token);
CREATE INDEX IF NOT EXISTS google_play_events_user_id_idx
  ON public.google_play_events (user_id);

GRANT ALL ON public.google_play_events TO service_role;

ALTER TABLE public.google_play_events ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: service role only (webhook + admin tooling).
