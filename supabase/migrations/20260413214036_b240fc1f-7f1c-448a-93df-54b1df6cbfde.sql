
-- Create two_factor_codes table (no RLS - accessed only via service role in edge functions)
CREATE TABLE IF NOT EXISTS public.two_factor_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_two_factor_codes_user_id ON public.two_factor_codes (user_id, used, expires_at);

-- Add two_factor_enabled to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;
