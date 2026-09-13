-- Web3 access foundation for AiTor paywalls.
-- No client can grant access, mark a payment as confirmed, or alter a wallet verification.

CREATE TABLE IF NOT EXISTS public.wallet_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id text NOT NULL,
  address text NOT NULL,
  verification_message text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_identities_address_format CHECK (address ~ '^0x[0-9a-fA-F]{40}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_identities_unique_address_per_chain
  ON public.wallet_identities (chain_id, lower(address));

CREATE INDEX IF NOT EXISTS wallet_identities_user_id_idx
  ON public.wallet_identities (user_id);

CREATE TABLE IF NOT EXISTS public.access_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_identity_id uuid REFERENCES public.wallet_identities(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('crypto_payment', 'nft')),
  tier public.credit_tier NOT NULL,
  chain_id text NOT NULL,
  asset text,
  expected_amount numeric(38,18),
  recipient_address text,
  transaction_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'failed')),
  expires_at timestamptz,
  confirmed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_orders_payment_fields CHECK (
    source <> 'crypto_payment' OR (asset IS NOT NULL AND expected_amount IS NOT NULL AND recipient_address IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS access_orders_unique_transaction_hash
  ON public.access_orders (lower(transaction_hash))
  WHERE transaction_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS access_orders_user_status_idx
  ON public.access_orders (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.access_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.access_orders(id) ON DELETE SET NULL,
  tier public.credit_tier NOT NULL,
  source text NOT NULL CHECK (source IN ('crypto_payment', 'nft', 'manual')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_entitlements_active_lookup_idx
  ON public.access_entitlements (user_id, tier, starts_at, ends_at)
  WHERE revoked_at IS NULL;

GRANT SELECT ON public.wallet_identities, public.access_orders, public.access_entitlements TO authenticated;
GRANT ALL ON public.wallet_identities, public.access_orders, public.access_entitlements TO service_role;

ALTER TABLE public.wallet_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet identities"
  ON public.wallet_identities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own access orders"
  ON public.access_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own entitlements"
  ON public.access_entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role is the only writer. A future verifier must validate ownership,
-- transaction status, asset and receiving address before writing these records.
CREATE POLICY "Service role manages wallet identities"
  ON public.wallet_identities FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages access orders"
  ON public.access_orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages access entitlements"
  ON public.access_entitlements FOR ALL TO service_role
  USING (true) WITH CHECK (true);
