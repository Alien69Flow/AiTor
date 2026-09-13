-- One-time challenges prevent a browser from claiming an arbitrary wallet address.
CREATE TABLE IF NOT EXISTS public.wallet_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id text NOT NULL,
  address text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_verification_challenges_address_format CHECK (address ~ '^0x[0-9a-fA-F]{40}$')
);

CREATE INDEX IF NOT EXISTS wallet_verification_challenges_active_lookup_idx
  ON public.wallet_verification_challenges (user_id, chain_id, address, expires_at)
  WHERE used_at IS NULL;

GRANT ALL ON public.wallet_verification_challenges TO service_role;

ALTER TABLE public.wallet_verification_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages wallet verification challenges"
  ON public.wallet_verification_challenges FOR ALL TO service_role
  USING (true) WITH CHECK (true);
