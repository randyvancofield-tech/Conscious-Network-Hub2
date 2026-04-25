# Conscious Network Hub

Conscious Network Hub is a full-stack TypeScript application with a React/Vite frontend and an Express backend. The backend owns authentication, user/session persistence, profile data, social data, membership state, uploads, AI routes, and blockchain integrity helpers.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL via Prisma
- Authentication: custom signed session tokens plus persisted session records
- Security: Helmet, CORS allowlist, request validation, rate limiting
- AI integrations: OpenAI and Google Cloud Vertex AI, enabled by backend env configuration
- Payments: Stripe membership checkout/webhooks
- Contracts tooling: Solidity compiler and deployment scripts under `contracts/`
- Testing: Jest integration tests for backend auth/persistence flows
- Deployment: Google Cloud Run backend, static frontend hosting for `dist/`

## Start Here

### Prerequisites

- Node.js 18+; Node.js 20+ is recommended
- npm
- PostgreSQL 14+ or a managed PostgreSQL instance
- Optional for AI routes: OpenAI key and/or Google Cloud Vertex AI credentials
- Optional for contract deployment: RPC URL and deployer private key

### Install

```powershell
npm install
npm --prefix server install
npm --prefix contracts install
```

### Configure

Create root `.env.local`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_ALLOW_REMOTE_BACKEND_IN_DEV=false
VITE_ENABLE_SIGNUP_2FA=false
```

Create `server/.env.local` from `server/.env.example` and set at minimum:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/conscious_network_hub
AUTH_PERSISTENCE_BACKEND=shared_db
DATABASE_PROVIDER=postgresql
AUTH_TOKEN_SECRET=replace-with-strong-random-secret
SENSITIVE_DATA_KEY=replace-with-32-byte-key-or-long-passphrase
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Keep backend secrets only in `server/.env.local`. Frontend env keys must be limited to `VITE_*` values.

### Initialize Database

```powershell
npm --prefix server run db:push
```

### Run Locally

Terminal A:

```powershell
npm --prefix server run dev
```

Terminal B:

```powershell
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

## Verification

Run these from the repo root:

```powershell
npm run check
```

That command runs the full local verification sequence:

```powershell
npm run build
npm --prefix server run build
npm --prefix server test
npm --prefix contracts run compile
```

Current known warning: the frontend production build emits a large chunk warning. It does not currently fail the build.

## Architecture

```text
React/Vite frontend
  -> /api/* requests with Authorization: Bearer <token>
Express backend
  -> validates signed token and persisted session
Prisma data layer
  -> PostgreSQL users, sessions, profiles, posts, memberships, uploads, provider state
External services
  -> OpenAI / Vertex AI, Stripe, email, blockchain RPC when configured
```

Authentication flow:

1. Signup starts in `App.tsx` via `handleCreateProfile`, calling `POST /api/user/create`.
2. Signin starts in `App.tsx` via `handleSignIn`, calling `POST /api/user/signin`.
3. Backend user routes validate payloads, password policy, persistence, lockout, and optional 2FA/provider rules.
4. Backend creates a persisted user session and returns a signed auth token.
5. Frontend stores the token through `services/sessionService.ts`.
6. Protected routes use `server/src/middleware.ts` `requireCanonicalIdentity` to validate both token and persisted session.
7. Logout calls `POST /api/user/logout` and revokes the persisted session.

## Project Structure

```text
.
|-- App.tsx                         # Main frontend application
|-- components/                     # React UI modules
|-- services/                       # Frontend API/session/security helpers
|-- contracts/
|   |-- HCNProfileAnchor.sol
|   |-- package.json                # Contract tooling dependencies
|   `-- tooling/                    # Compile/deploy scripts
|-- docs/
|   |-- CLEANUP_BASELINE.md         # Cleanup inventory and log
|   `-- ENVIRONMENT_MATRIX.md       # Canonical env reference
|-- server/
|   |-- prisma/schema.prisma
|   |-- src/index.ts                # Express app entry
|   |-- src/routes/                 # API route modules
|   |-- src/services/               # Persistence/integration services
|   `-- README.md                   # Backend-specific guide
|-- SETUP_GUIDE.md
|-- DEPLOYMENT_RUNBOOK.md
`-- AGENTS.md
```

## Canonical Docs

- [Setup Guide](./SETUP_GUIDE.md): full local setup path
- [Environment Matrix](./docs/ENVIRONMENT_MATRIX.md): frontend/backend env keys
- [Backend README](./server/README.md): backend routes, auth, persistence, and scripts
- [Backend Testing](./server/TESTING.md): backend Jest and smoke-test examples
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md): Cloud Run release checks
- [Cleanup Baseline](./docs/CLEANUP_BASELINE.md): cleanup inventory, decisions, and progress log
- [AGENTS.md](./AGENTS.md): agent-facing project/auth guidance

## Deployment

Backend deployment is currently Google Cloud Run. Use the deployment runbook for exact checks:

```powershell
cd server
npm run deploy:cloudrun
npm run check:cloudrun
```

Frontend deployment builds `dist/` from the repo root:

```powershell
npm run build
```

Confirm `.env.production` points `VITE_BACKEND_URL` at the production backend before releasing frontend assets.

## Contracts

Contract tooling is separated from daily frontend runtime:

```powershell
npm --prefix contracts run compile
npm run deploy:contracts
```

Deployment requires RPC and deployer secrets such as `DEPLOY_RPC_URL` and `DEPLOYER_PRIVATE_KEY`.
