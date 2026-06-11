
-- Idempotent ledger for Apple IAP grants so retries never double-credit.
CREATE TABLE public.apple_iap_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id uuid REFERENCES public.circles(id) ON DELETE SET NULL,
  product_id text NOT NULL,
  transaction_id text NOT NULL,
  original_transaction_id text,
  kind text NOT NULL,
  seats_added integer NOT NULL DEFAULT 0,
  plan text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX apple_iap_grants_txn_unique ON public.apple_iap_grants(transaction_id);
CREATE INDEX apple_iap_grants_user_idx ON public.apple_iap_grants(user_id);
CREATE INDEX apple_iap_grants_circle_idx ON public.apple_iap_grants(circle_id);

GRANT SELECT ON public.apple_iap_grants TO authenticated;
GRANT ALL ON public.apple_iap_grants TO service_role;

ALTER TABLE public.apple_iap_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IAP grants"
  ON public.apple_iap_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
