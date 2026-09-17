CREATE TABLE public.crypto_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tx_hash text NOT NULL UNIQUE,
  chain text NOT NULL,
  plan public.credit_tier NOT NULL,
  amount_usd numeric NOT NULL,
  wallet_address text,
  recipient text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crypto_payments TO authenticated;
GRANT ALL ON public.crypto_payments TO service_role;

ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own crypto payments"
ON public.crypto_payments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages crypto payments"
ON public.crypto_payments FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "No client writes to crypto payments"
ON public.crypto_payments AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (true) WITH CHECK (false);

CREATE INDEX crypto_payments_user_idx ON public.crypto_payments (user_id, created_at DESC);