# Simple Purchase DApp

A small e-commerce app where sellers list products and customers buy them,
but the payment itself is escrowed in an Ethereum smart contract and only
released to the seller once the customer confirms delivery.

## Stack

- **Contract**: Solidity escrow contract (`contracts/`), Hardhat 3 + Ignition
  for compiling, testing, and deploying.
- **Backend**: Node.js + Express + TypeScript (`backend/`), PostgreSQL via
  Prisma, ethers.js for talking to the chain.
- **Frontend**: React + Vite (`frontend/`), minimal UI to exercise the full
  flow.
- **Infra**: Docker Compose runs the whole stack locally; a self-hosted
  GitHub Actions runner (see `infra/github-runner/SETUP.md`) runs CI against
  a real local Hardhat chain, then CD deploys straight to the same server.

## How it works

1. Users register as a **seller** or **customer** with email/password. On
   registration the backend generates an EVM wallet for them, encrypts the
   private key at rest, and funds it with test ETH from a local faucet
   account (see `SECURITY.md` for why this custodial model exists and its
   limits).
2. Sellers list products (name, price in wei, stock) and can update stock or
   view incoming orders.
3. Customers browse products from any seller and buy. Buying escrows the
   full payment in the `Marketplace` contract (`contracts/contracts/Marketplace.sol`)
   — the backend signs and submits this transaction on the customer's
   behalf.
4. The customer confirms delivery once it arrives, which releases the
   escrowed funds to the seller on-chain.

Product catalog and stock live in Postgres (source of truth for listings);
the contract only ever tracks an order id, the two parties' addresses, and
an escrowed amount.

## Running locally

Requires Docker and Docker Compose.

```bash
docker compose up -d --wait
```

This builds and starts, in order: Postgres, the local Hardhat node, a
one-shot deploy of the `Marketplace` contract, the backend API, and the
frontend. No manual steps required.

- Frontend: http://localhost:5173
- Backend API: http://localhost:8090/api/v1 (health check at `/health`)
- Hardhat JSON-RPC: http://localhost:8545

Copy `.env.example` to `.env` to override any of the defaults (JWT secret,
encryption key, faucet account, etc.) — see that file for details.

Tear down with `docker compose down` (add `-v` to also drop the Postgres
volume and start fresh next time).

## Running tests

**Contract tests** (Hardhat + mocha, in-process chain, no setup needed):

```bash
cd contracts
npm install
npm test
```

**Backend integration tests** (supertest against a real Postgres test DB and
a real local Hardhat chain — both need to be running):

```bash
docker compose up -d --wait postgres hardhat-node
docker compose exec postgres psql -U dapp -d dapp -c "CREATE DATABASE dapp_test;"

cd contracts && npm run deploy:localhost   # writes the contract address the tests read

cd ../backend
npm install
DATABASE_URL="postgresql://dapp:dapp@localhost:5433/dapp_test?schema=public" npx prisma migrate deploy
npm run test:integration
```

(`.github/workflows/ci.yml` runs exactly this sequence, plus a full-stack
deployment smoke test, on the self-hosted runner.)

## CI/CD

`.github/workflows/ci.yml` has two jobs on the self-hosted runner:

- **`test`** (every push and PR to `main`): the sequence above, ending with
  `docker compose down -v` so each run is hermetic.
- **`deploy`** (pushes to `main` only, after `test` passes): writes a real
  `.env` from GitHub Actions secrets and runs `docker compose up -d --build`
  in place on the runner host — no registry, no separate deploy target,
  since the runner *is* the deployment server. See
  `infra/github-runner/SETUP.md` for the secrets it needs configured.

## Project structure

```
contracts/    Hardhat project: Marketplace.sol, tests, Ignition deploy module
backend/      Express API: auth, products, orders modules + blockchain glue
frontend/     React/Vite UI
infra/        Self-hosted GitHub Actions runner setup notes
.github/      CI workflow
```

See `SECURITY.md` for the custodial wallet model's tradeoffs before using
any of this beyond local testing.
