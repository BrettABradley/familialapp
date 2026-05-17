CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  source text
);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (edge functions) can read/write.
-- This is intentional — we don't want to expose the list publicly.
CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON public.email_unsubscribes(lower(email));