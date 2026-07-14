# Security notes

This project is a demo/test build of an e-commerce DApp, not a
production-ready system. The custodial wallet model in particular makes
tradeoffs that would be unacceptable for handling real funds.

## Custodial wallet model

Every user gets an EVM keypair generated on the backend at registration
time. The private key is encrypted (AES-256-GCM, key from the
`ENCRYPTION_KEY` env var) and stored in Postgres; the backend decrypts it
and signs transactions on the user's behalf when they call the purchase /
confirm-delivery endpoints.

This means:

- The backend process has access to plaintext private keys in memory during
  every signing operation.
- Key confidentiality reduces entirely to the confidentiality of
  `ENCRYPTION_KEY` and the security of the database and backend host. Anyone
  with both the DB and the encryption key can drain every user's wallet.
- There is no user-side confirmation step (e.g. a wallet extension prompt)
  before a transaction is signed and sent -- the API endpoint itself is the
  only authorization boundary.

This tradeoff is intentional for this build: it lets purchase and
delivery-confirmation flows be exercised end-to-end (including in
automated tests) without a browser wallet extension. It is not a pattern to
carry into a system handling real value. A production version would use
client-side signing (e.g. a wallet extension or WalletConnect) so the
backend never touches private keys at all.

## Faucet account

`FAUCET_PRIVATE_KEY` defaults to one of Hardhat's 20 built-in test accounts
-- its private key is published in Hardhat's own documentation and is
funded only on ephemeral local/test chains. Never point this configuration
at a real network; the account has no real funds and the key is public
knowledge.

## Secrets in this repo

`backend/.env.test` is committed intentionally: it contains only the
well-known Hardhat test key above and `localhost` connection strings, no
real secrets, and CI needs it to run the integration suite. `backend/.env`
and any other `.env` file are gitignored and must never be committed.

## JWT secret

`JWT_SECRET` defaults to a placeholder value in `docker-compose.yml` and
`.env.example`. Set a real, random value via a `.env` file (or your
deployment platform's secret store) for anything beyond local testing.
