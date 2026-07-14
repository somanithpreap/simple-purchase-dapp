# Security notes

This project is a demo/test build of an e-commerce DApp, not a
production-ready system.

## Non-custodial wallet model

Users connect their own wallet (MetaMask, or any injected `window.ethereum`
provider) and sign every `purchase()` / `confirmDelivery()` transaction
themselves in the browser. The backend never holds, generates, or has
access to a user's private key -- it only:

1. Issues a one-time nonce and verifies a signature over it (`POST
   /wallet/nonce`, `POST /wallet/connect`) to link a wallet address to an
   account. This proves *ownership* of the address; it never asks for or
   sees a private key.
2. After the user submits a transaction client-side, independently fetches
   the transaction receipt and decodes the contract's own event logs
   (`backend/src/blockchain/verifyTx.ts`) to confirm what actually happened
   on-chain before updating order state -- it never trusts a client-supplied
   transaction hash at face value.

This means a compromised backend can misrepresent order/product state in
Postgres, but cannot move a user's funds -- there is no key for it to
extract, and every fund movement requires the user's own wallet signature.

## Faucet accounts (local Hardhat dev only)

The old backend-managed faucet that auto-funded every new user's custodial
wallet has been removed along with custodial signing. For local Hardhat
development, import one of Hardhat's 20 well-known dev accounts directly
into MetaMask (their private keys are published in Hardhat's own
documentation and are funded only on ephemeral local/test chains -- never
point them at a real network). For Sepolia, users fund their own wallet
from a public testnet faucet.

## Secrets in this repo

`backend/.env.test` is committed intentionally: it contains only
`localhost` connection strings and a test JWT secret, no real secrets, and
CI needs it to run the integration suite. `backend/.env` and any other
`.env` file are gitignored and must never be committed. `SEPOLIA_RPC_URL`
and `SEPOLIA_DEPLOYER_PRIVATE_KEY` (see `.env.example`) are contracts-deploy
-only, used once locally via `npm run deploy:sepolia`, and must never be
committed either.

## JWT secret

`JWT_SECRET` defaults to a placeholder value in `docker-compose.yml` and
`.env.example`. Set a real, random value via a `.env` file (or your
deployment platform's secret store) for anything beyond local testing.
