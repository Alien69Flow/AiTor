# Implementation Log

## Globe stabilization — 15 August 2026

### Completed

- Connected the tactical legend to the Cesium renderer.
- Standardized tactical categories used by the dashboard and globe layers.
- Made market arcs visible only when both related hotspots are enabled.
- Preserved valid flight and marine markers at latitude or longitude `0`.
- Stabilized the local production build by removing MCP code generation that wrote a machine-specific Windows path into the Supabase function.
- Pinned the MCP package version and synchronized the dependency lockfile.

### Validation

- Production build completed successfully with Vite.

### Next priorities

1. Resolve the existing TypeScript and lint backlog in Globe and agent modules.
2. Add layer-combination regression tests for the Globe.
3. Implement Reown wallet connection and the crypto/NFT paywall after chain and billing rules are defined.

## Module 1 delivery plan — 15 August 2026

### Completed

- Published a delivery plan that records the current baseline, completion scope, ownership, acceptance criteria, and required Web3 decisions.
- Stored the plan in `docs/AiTor_Modulo_1_Plano_de_Entrega.docx` and published it to the private project repository.
- Re-ran the Vite production build successfully after documenting the plan.

### Remaining external decisions

- Supported chain(s), Reown project ID, accepted asset, price and receiving wallet.
- NFT contract, token ID rules and the access tier granted by ownership.
- Production deployment ownership and the final Telegram-to-web payment journey.

## Paywall foundation — 15 August 2026

### Completed

- Added a service-role-only data model for verified wallets, payment orders and access entitlements.
- Added an authenticated access-status endpoint so the web and Telegram flows can consume the same access source.
- Added the owner handoff document with configuration values and the server-side verification sequence.

### Deliberate boundary

- No payment, NFT possession or wallet is accepted as valid until owner-supplied network and billing rules are configured and verified server-side.

## Wallet connection and public DAO references — 19 August 2026

### Completed

- Recovered the public Reown configuration, supported EVM networks, DAO references and OpenSea profiles from the official AlienFlowSpace source repository.
- Added the Reown AppKit wallet connection to the AiTor top navigation. It supports Polygon as the default network, plus Ethereum, Arbitrum, Base and BSC.
- Shows the connected wallet's abbreviated public address and opens the account screen on a subsequent click.
- Documented the official public references and the remaining verification requirement for NFT access.

### Validation

- Vite production build completed successfully.

### Still intentionally pending

- A specific NFT contract address, token eligibility rule, payment recipient, asset and price. OpenSea profile URLs alone cannot be used to verify ownership or grant access.

## Secure wallet linking — 19 August 2026

### Completed

- Added one-time, expiring wallet-verification challenges in Supabase.
- Added the authenticated `wallet-link` Edge Function. It verifies an EVM signature on the server before associating a public wallet address with the logged-in user.
- Updated the wallet button to guide the user through connect → sign → verified status.
- Updated tier resolution to consume confirmed backend entitlements in addition to the existing credit tier.

### Deployment boundary

- The migration and Edge Functions require deployment by the owner of the Supabase project. No service key, seed phrase or private key is required from Aitor or from a wallet holder.

## Module 1 production readiness — 19 August 2026

### Verified public routes

- AiTor domain, Telegram bot, Telegram Mini App and the deployed POST-only webhook route are reachable.

### Completed in code

- Added the production environment template and M1 go-live checklist.
- Changed Telegram webhook validation to fail closed when its secret is missing or invalid.
- Replaced the broken Telegram short-name Mini App link with a configurable direct Web App button.

### Owner-only activation

- Configure encrypted production variables, register Telegram's webhook secret, deploy, and run the real-account acceptance test described in `docs/M1_TELEGRAM_GO_LIVE.md`.
