# AiTor Paywall: owner handoff

This foundation is ready for the owner decisions. It deliberately grants no access from the browser and it does not accept a transaction hash as proof by itself.

## What is already prepared

- `wallet_identities`: links a verified EVM wallet to an authenticated user.
- `access_orders`: records a requested crypto payment or NFT verification.
- `access_entitlements`: is the source of truth for paid access after server-side verification.
- `access-status`: authenticated endpoint that returns active entitlements for the current user.
- `wallet-link`: authenticated endpoint that creates a five-minute challenge and verifies an EVM wallet signature before linking it to the logged-in account.
- The web header now connects through Reown and asks the connected user to sign the ownership proof once.

## Deployment required

The web build is ready, but the verification endpoint only becomes live after a Supabase owner deploys the migration and functions to project `wkdtvrxavkhbifjtvvdw`:

```bash
supabase login
supabase link --project-ref wkdtvrxavkhbifjtvvdw
supabase db push
supabase functions deploy access-status
supabase functions deploy wallet-link
```

`SUPABASE_SERVICE_ROLE_KEY` is supplied by Supabase to deployed Edge Functions. It must never be added to the website, GitHub, Telegram or a `.env` committed to the repository.

## Public configuration recovered from AlienFlow sources

- Reown project ID: configured in the public AlienFlowSpace app. AiTor uses it as a fallback and allows `VITE_REOWN_PROJECT_ID` to override it per deployment.
- Primary network: Polygon (`eip155:137`). The wallet modal also supports Ethereum, Arbitrum, Base and BSC, matching the public AlienFlowSpace configuration.
- DAO references on Polygon:
  - AlienFlowSpace DAO: `0xCA497d631DB260ebFFF4bA71AEAc3201ae972a77`
  - Alien69Flow DAO: `0x2A1F32A807b3f8a43F9473C1FA7d11881A579b16`
- Public OpenSea profiles: `Alien69Flow` and `AlienFlowSpace`.

These references identify public DAO and marketplace profiles, but **they do not identify a specific NFT smart contract or access rule**. The paywall must not use a marketplace profile as proof of ownership.

## What the owner must still decide

1. `PAYWALL_CHAIN_ID`: EVM CAIP-2 identifier, for example `eip155:137`.
2. `PAYWALL_ASSET`: payment asset, for example `USDC`.
3. `PAYWALL_RECIPIENT_ADDRESS`: public treasury address that receives payments.
4. `PAYWALL_ARCHITECT_PRICE`: price in the asset's base units or a documented decimal convention.
5. `PAYWALL_ACCESS_DAYS`: access duration after a confirmed payment.
6. Optional override: `VITE_REOWN_PROJECT_ID` for a separate AiTor Reown project.
7. NFT access: contract address, chain and membership rule for each collection.

## Implementation order after owner confirmation

1. Add Reown AppKit and connect an EVM wallet.
2. Ask the wallet to sign a one-time ownership message; verify it server-side before setting `verified_at`.
3. Create an `access_orders` record server-side with the fixed payment destination and price.
4. Ask the user to send the payment, then verify the transaction with an RPC/provider on the server.
5. Only after chain, recipient, asset and amount match, create `access_entitlements` and update `user_credits.paid_tier`.
6. Make the Telegram bot consult the same entitlement before allowing paid actions.

## Security rules

- Never grant a tier from the browser, a Telegram message, or a transaction hash supplied by the user.
- Never store a seed phrase, private key or wallet password.
- The service role performs all writes to wallet, order and entitlement tables.
- Make a small test payment before enabling production access.
