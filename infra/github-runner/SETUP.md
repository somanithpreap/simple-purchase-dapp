# Self-hosted GitHub Actions runner

This document is a manual, one-time setup guide for installing a self-hosted
GitHub Actions runner on the same server that hosts the local EVM (Hardhat)
node used for testing. It is intentionally **not** automated from this repo:
runner registration tokens are short-lived and per-repo, so there is nothing
safe to commit or script end-to-end.

## Why the runner lives outside Docker

The CI workflow (`.github/workflows/ci.yml`) drives the app with
`docker compose`. For that to work, the runner process itself must run
directly on the host — not inside a container — so it can reach the host's
Docker daemon and invoke `docker compose` the same way a developer would.

## Prerequisites

- A Linux server (these steps assume Ubuntu/Debian; adjust package manager
  commands for other distros).
- Docker Engine and the Docker Compose plugin installed and running
  (`docker compose version` should succeed).
- Outbound HTTPS access to `github.com` and `*.actions.githubusercontent.com`.

## 1. Install Docker (skip if already installed)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
```

## 2. Create a dedicated runner user and add it to the `docker` group

Running the runner as its own unprivileged user, in the `docker` group, lets
it invoke `docker compose` without needing broader sudo access.

```bash
sudo useradd -m -s /bin/bash actions-runner
sudo usermod -aG docker actions-runner
sudo su - actions-runner
```

## 3. Download and configure the runner

In your GitHub repo: **Settings → Actions → Runners → New self-hosted
runner**, pick Linux/x64, and copy the exact download + configure commands
GitHub shows you (the version number and registration token are unique to
your repo and expire quickly). It will look like this:

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/vX.Y.Z/actions-runner-linux-x64-X.Y.Z.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz

./config.sh --url https://github.com/<org-or-user>/<repo> --token <REGISTRATION_TOKEN>
```

Accept the defaults (runner group `Default`, name defaults to the hostname,
work folder `_work`, labels default to `self-hosted,linux,x64`) unless you
have a reason to change them — the workflow targets `runs-on: self-hosted`,
which matches any runner carrying that label.

## 4. Install and start the runner as a service

Still as the `actions-runner` user:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

Check it's connected: **Settings → Actions → Runners** in GitHub should show
it as **Idle**.

## 5. Verify Docker access

```bash
docker compose version
docker ps
```

Both should succeed without `sudo`. If you get a permission error, confirm
the `actions-runner` user was added to the `docker` group (step 2) and that
you started a fresh shell/session afterward (group membership only applies
to new login sessions).

## 6. Configure CD secrets

The `deploy` job in `.github/workflows/ci.yml` runs on this same server
after the `test` job passes (only on pushes to `main`). It writes a `.env`
file from GitHub Actions secrets and runs `docker compose up -d --build`
in place — no registry push, no separate deploy target, since the runner
and the app live on the same box.

Create a GitHub **Environment** named `production` (**Settings → Environments
→ New environment**) and add these as *environment secrets* (or as
repo-level Actions secrets if you'd rather skip the Environment — just
remove the `environment: production` line from the `deploy` job):

| Secret               | Value                                                                 |
| -------------------- | ---------------------------------------------------------------------|
| `POSTGRES_PASSWORD`  | Any strong password (defaults to `dapp` if unset — change it)        |
| `JWT_SECRET`         | Random string used to sign backend JWTs                              |
| `ENCRYPTION_KEY`     | 32 bytes as hex (64 chars) — see `.env.example` for how to generate  |
| `FAUCET_PRIVATE_KEY` | Leave as Hardhat's default account key unless you know you want otherwise — see `SECURITY.md` |
| `FAUCET_AMOUNT_ETH`  | e.g. `1`                                                              |

`VITE_API_BASE_URL` is not needed: nginx (`frontend/nginx.conf`) reverse-proxies
`/api/*` to the backend container, so the frontend bundle calls a same-origin
relative path regardless of the server's domain/IP. Only set it as a secret
if the frontend and backend are ever split across different origins.

An Environment also lets you add protection rules (e.g. required
reviewers) in front of deploys if you want a manual gate before `main`
goes live.

If the server should be reachable from outside (not just `localhost`),
open the relevant inbound ports in your firewall/security group: `5173`
(frontend — now also serves the backend API via nginx reverse proxy, so
`8090` no longer needs to be exposed publicly), and optionally `8545` (Hardhat RPC, only
if you want external tools to query the chain directly).

## Updating or removing the runner

- To update: stop the service (`sudo ./svc.sh stop`), download the new
  runner version, re-run `./config.sh` if GitHub requires re-registration,
  then reinstall/start the service.
- To remove: `sudo ./svc.sh stop && sudo ./svc.sh uninstall`, then run
  `./config.sh remove --token <REMOVAL_TOKEN>` (generate the removal token
  from the same GitHub Runners settings page).
