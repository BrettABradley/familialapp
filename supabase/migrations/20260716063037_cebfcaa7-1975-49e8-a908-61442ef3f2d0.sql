CREATE TABLE IF NOT EXISTS public.google_iap_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_token TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  circle_id UUID,
  source TEXT NOT NULL DEFAULT 'google',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_iap_grants_user ON public.google_iap_grants(user_id);

GRANT ALL ON public.google_iap_grants TO service_role;

ALTER TABLE public.google_iap_grants ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT policies for authenticated: only the edge function
-- (using service_role) reads/writes this ledger. Mirrors apple_iap_grants.
CREATE POLICY "service role manages google iap grants"
ON public.google_iap_grants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);