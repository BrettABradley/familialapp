
CREATE TABLE public.unverified_apple_receipts (
  transaction_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id text NOT NULL,
  kind text NOT NULL,
  circle_id uuid,
  rescue_circle_id uuid,
  last_error_code text,
  last_error_detail text,
  attempts integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  jws_representation text,
  raw jsonb
);

CREATE INDEX unverified_apple_receipts_user_idx ON public.unverified_apple_receipts(user_id);
CREATE INDEX unverified_apple_receipts_last_attempt_idx ON public.unverified_apple_receipts(last_attempt_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unverified_apple_receipts TO authenticated;
GRANT ALL ON public.unverified_apple_receipts TO service_role;

ALTER TABLE public.unverified_apple_receipts ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view; service role bypasses RLS for writes
CREATE POLICY "Platform admins can view unverified receipts"
ON public.unverified_apple_receipts
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));
