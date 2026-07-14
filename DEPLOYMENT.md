# Contract deployment guide

How `Marketplace.sol` gets deployed, locally and to Sepolia. For running/
testing the app once deployed, see `TESTING.md`.

## Local deployment

You almost never need to do this manually — it's automatic.

**Automatic (Docker):** `docker compose --profile local-chain up -d` runs
the one-shot `contract-deploy` service, which deploys to the `hardhat-node`
container over Hardhat's `docker` network config
(`contracts/hardhat.config.ts`) and writes the address to a shared Docker
volume the `backend` service reads at startup. Nothing to configure.

**Manual (host-side):** needed when running the backend integration test
suite directly on the host (see `TESTING.md` → "Automated tests") against a
Docker-published `hardhat-node`, since that test run resolves the contract
address from a host-relative file, not the Docker volume:

```bash
cd contracts
npm run deploy:localhost
```

This deploys via the `localhost` network config (`http://127.0.0.1:8545`)
and writes to `contracts/ignition/deployments/chain-31337/` (`.gitignore`d —
purely local state, safe to delete and re-run any time you want a clean
redeploy).

Both of these deploy the exact same `Marketplace.sol`, no constructor args,
no per-network branching in `contracts/ignition/modules/Marketplace.ts`.

## Sepolia deployment

This is a real, one-time (per-address) deployment — it costs real (if
worthless) gas and the result should be treated as stable, not something
you redeploy casually. See "Redeploying" below for why.

### 1. Get a Sepolia RPC endpoint

Sign up for a free tier with an RPC provider — Alchemy or Infura are the
common choices — and create a Sepolia app/endpoint. You'll get an HTTPS URL
like `https://eth-sepolia.g.alchemy.com/v2/<your-api-key>`.

### 2. Create and fund a deployer wallet

This should be a **dedicated wallet you only use for deploying this
contract** — not your personal wallet, not a wallet holding anything of
value, and definitely not one of Hardhat's public local dev keys.

1. Create a fresh account in MetaMask (or generate a keypair any other way
   you trust) and note its private key and address.
2. Fund the *address* with Sepolia ETH from a faucet — you only need enough
   to cover one contract deployment's gas (a small fraction of an ETH). See
   `TESTING.md` → "Fund test wallets" for faucet options.

### 3. Set the deployer env vars

Hardhat resolves `configVariable(...)` values directly from environment
variables (`contracts/hardhat.config.ts`'s `sepolia` network reads
`SEPOLIA_RPC_URL` and `SEPOLIA_DEPLOYER_PRIVATE_KEY`). There's no `.env`
auto-loading in `contracts/`, so export them in your shell before deploying:

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/<your-api-key>"
export SEPOLIA_DEPLOYER_PRIVATE_KEY="0x<your-deployer-private-key>"
```

(PowerShell: `$env:SEPOLIA_RPC_URL = "..."`, `$env:SEPOLIA_DEPLOYER_PRIVATE_KEY = "..."`.)

Never commit these values or put them in a tracked file — `.env.example`
documents them as placeholders only, and only as env vars for this one-off
deploy step, not something `docker-compose.yml` or the backend ever reads.

### 4. Deploy

```bash
cd contracts
npm run deploy:sepolia
```

Hardhat Ignition prints the deployed address on success, e.g.:

```
Deployed Addresses

MarketplaceModule#Marketplace - 0x1234...
```

### 5. Point the app at it

Set `CONTRACT_ADDRESS` (and `RPC_URL`, if not already set to the same
Sepolia endpoint) in your `.env` for the app itself — see `TESTING.md` →
"Configure the stack for Sepolia" for the full env block and how to bring
the stack up against it.

### 6. Verify

- `curl http://localhost:8090/api/v1/contract-info` (once the backend is
  running against Sepolia) should return the address you just deployed and
  `chainId: 11155111`.
- Look the address up on a Sepolia block explorer to confirm the contract
  code is there and matches what you expect.

### Redeploying

There's no upgrade mechanism — `Marketplace.sol` is immutable once deployed,
and Ignition will deploy a brand-new contract at a new address if you run
`deploy:sepolia` again. Any orders escrowed in the *old* contract stay
stranded there (their funds are only reachable by calling `confirmDelivery`/
`cancelOrder` against that old address with the original buyer/seller keys —
the app, pointed at the new `CONTRACT_ADDRESS`, won't see them anymore).
Treat a Sepolia deployment as effectively permanent for the lifetime of any
test data you care about; only redeploy when you're fine abandoning
whatever's currently escrowed.
