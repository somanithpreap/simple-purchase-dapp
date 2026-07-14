# Testing guide

Two ways to exercise this app: against a local Hardhat chain (fast, free,
zero setup) or against Sepolia (slow, needs real testnet ETH, but is the
real non-custodial MetaMask flow end-to-end). Contract deployment specifics
live in `DEPLOYMENT.md` — this doc assumes the contract is already deployed
and focuses on running/testing the app around it.

## Local testing

### Prerequisites

- Docker + Docker Compose
- MetaMask installed in your browser
- Node.js 22+ if you also want to run the automated test suites on the host

### 1. Start the stack

```bash
docker compose --profile local-chain up -d
```

This builds and starts, in order: Postgres, the local Hardhat node
(`hardhat-node`), a one-shot deploy of `Marketplace.sol` (`contract-deploy`),
the backend API, and the frontend. The `local-chain` profile is what starts
`hardhat-node`/`contract-deploy` at all — see `.env.example` and
`docker-compose.yml` for why.

Check everything came up healthy:

```bash
docker compose ps
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8090/api/v1 (health check at `/health`)
- Hardhat JSON-RPC: http://localhost:8545

If you changed backend/frontend/contracts code since the last build, rebuild
first — `docker compose up` does **not** rebuild images automatically:

```bash
docker compose --profile local-chain build
docker compose --profile local-chain up -d
```

### 2. Connect MetaMask to the local chain

Add a network in MetaMask (**Settings (three bars) → Networks → Add a network
manually**):

| Field           | Value                   |
| --------------- | ----------------------- |
| Network name    | Hardhat Local           |
| New RPC URL     | `http://127.0.0.1:8545` |
| Chain ID        | `31337`                 |
| Currency symbol | ETH                     |

Then import one of Hardhat's pre-funded dev accounts (**Account dropdown → Add wallet → Import an account**) so you have test ETH to work with.
Account #0's key (10,000 ETH, well-known/public — never use on a real
network):

```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Import a second one for your second test role (buyer vs. seller need
different addresses) — the rest of Hardhat's 20 dev keys are printed to the
`hardhat-node` container's logs (`docker compose logs hardhat-node`).

### 3. Walk through the app

1. Open http://localhost:5173, register a **seller** account and a
   **customer** account (two different browser profiles or an incognito
   window, since sessions are per-tab `localStorage`).
2. For each, click **Connect Wallet** in the nav bar and pick a different
   imported MetaMask account — this does the nonce/signature handshake
   (`POST /wallet/nonce` → sign → `POST /wallet/connect`) that links the
   address to the account.
3. As the seller: list a product (name, price in ETH, stock, optional image
   URL).
4. As the customer: buy it. MetaMask will prompt you to sign the on-chain
   `purchase()` transaction — approve it. The nav bar balance should drop by
   the price + gas.
5. As the customer again: go to **My orders** and confirm delivery once the
   order shows `ESCROWED` — another MetaMask signature, releasing the
   escrowed funds to the seller.
6. Check both accounts' balances (nav bar, or directly in MetaMask) to
   confirm the funds moved.

### 4. Resetting state

`hardhat-node`'s chain state does **not** persist across container restarts
(it's an in-memory chain) — a fresh `docker compose --profile local-chain up`
after a `down` gives you a clean chain and a freshly redeployed contract at
the same address. To reset just the app data without touching the chain:

```bash
docker compose down -v   # also drops the Postgres volume
docker compose --profile local-chain up -d
```

### 5. Automated tests

**Contract tests** (Hardhat + mocha, in-process chain, no setup needed):

```bash
cd contracts
npm install
npm test
```

**Backend integration tests** (supertest, against a real Postgres test DB
and a real local Hardhat chain — both need to be running). This deploys its
_own_ copy of the contract on the host side (separate from the
`contract-deploy` container's copy that the Docker `backend` service uses) —
that's expected; they're independent, self-consistent setups.

```bash
docker compose --profile local-chain up -d postgres hardhat-node
docker compose exec postgres psql -U dapp -d dapp -c "CREATE DATABASE dapp_test;"

cd contracts && npm run deploy:localhost   # writes the address backend/.env.test reads

cd ../backend
npm install
DATABASE_URL="postgresql://dapp:dapp@localhost:5433/dapp_test?schema=public" npx prisma migrate deploy
npm run test:integration
```

`backend/.env.test` is already checked in with the right values for this
flow (`RPC_URL=http://127.0.0.1:8545`, a `TX_RECEIPT_TIMEOUT_MS` short
enough for Hardhat's instant mining, etc.) — no changes needed.

### Troubleshooting

- **`ZodError` about missing env vars on `docker compose up`** — you're
  running a stale image built before an env var was renamed/added. Rebuild:
  `docker compose --profile local-chain build`.
- **Something else already using port 8545** — check for a stray native
  `hardhat node` process (`npx hardhat node` run directly on the host,
  outside Docker) still listening on `127.0.0.1:8545` from an earlier
  session; it'll silently intercept traffic meant for the Docker container
  and cause confusing on-chain state mismatches. Find and kill it, or stop
  the Docker container and use the native one consistently — don't run both
  against the same port.
- **Integration tests fail with `OrderAlreadyExists` or with the tx
  "succeeding" but no event being emitted** — `backend/.env.test`'s
  `CONTRACT_ADDRESS_FILE` points at `contracts/ignition/deployments/`,
  which is `.gitignore`d local state. If it's stale (pointing at a contract
  address from a previous chain instance that no longer exists), delete it
  and redeploy: `rm -rf contracts/ignition/deployments/chain-31337 && (cd
contracts && npm run deploy:localhost)`.

## Sepolia testing

This exercises the real non-custodial flow end-to-end: real (if worthless)
ETH, real ~12s block times, MetaMask's built-in Sepolia network instead of a
manually-added one. See `DEPLOYMENT.md` for deploying the contract to
Sepolia first — you need a deployed `CONTRACT_ADDRESS` before any of this
works.

### 1. Configure the stack for Sepolia

In your `.env` (copy from `.env.example` if you haven't):

```
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-api-key>
CONTRACT_ADDRESS=0x...   # from DEPLOYMENT.md
```

And **remove or comment out** `COMPOSE_PROFILES=local-chain` — you don't
want the local Hardhat chain/deploy services starting at all, since the app
should point entirely at Sepolia.

Start just the services that make sense for this (Postgres, backend,
frontend):

```bash
docker compose up -d --build
```

Without the `local-chain` profile active, `hardhat-node` and
`contract-deploy` won't start — confirm with `docker compose ps`.

### 2. Fund test wallets

Every user connects their **own** MetaMask wallet and pays their own gas —
there's no backend faucet anymore (removed along with custodial signing).
For each role you want to test (buyer, seller):

1. Switch MetaMask to **Sepolia** (built-in network, no manual setup
   needed — just don't reuse your local Hardhat dev-key accounts here,
   their private keys are public).
2. Get free Sepolia ETH from a faucet (e.g. Google Cloud's Web3 faucet,
   Alchemy's Sepolia faucet, or a PoW faucet — search "Sepolia ETH faucet"
   if a specific one is down/changed its requirements). Buyers need enough
   to cover the product price plus gas; sellers just need a little for gas
   on `confirmDelivery`-adjacent actions (though delivery confirmation is
   actually signed by the buyer in this app — sellers mostly just receive
   funds).

### 3. Walk through the app

Same flow as local testing (register → connect wallet → list/buy/confirm),
with two differences to expect:

- Each MetaMask signature now costs **real gas** (worthless testnet ETH,
  but the UX is the same as mainnet — confirmations aren't instant).
- Transactions take up to ~12s to mine per block, sometimes a few blocks to
  feel "confirmed." The backend's tx-verification endpoints
  (`/orders/:id/submit-tx`, `/orders/:id/submit-confirm-tx`) poll for the
  receipt for up to `TX_RECEIPT_TIMEOUT_MS` (120s default) before giving up
  — don't need to touch this unless Sepolia is unusually congested.

Check transactions on a Sepolia block explorer using the tx hash shown in
the app (`purchaseTxHash`/`confirmTxHash` on the order) to see them
confirmed on-chain independent of the app's own UI.
