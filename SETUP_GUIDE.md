# Conscious Network Hub Setup Guide

This guide is the canonical local setup path for the current production architecture.

## 1. Backend Choice (Task 2 Decision)

Use the existing backend stack:

- Backend: Node.js + Express (TypeScript)
- Data layer: Prisma
- Database: PostgreSQL
- Persistence mode: `AUTH_PERSISTENCE_BACKEND=shared_db`

This is the correct choice because auth, sessions, profile writes, and post writes already depend on this path in production.

## 2. Prerequisites

- Node.js 18+ (20+ recommended)
- npm
- PostgreSQL 14+ (local or managed)
- Optional for AI routes: Google Cloud credentials + Vertex AI access

## 3. Install Dependencies

From repository root:

```powershell
npm install
npm --prefix server install
```

## 4. Configure Environment Files

### Frontend env

Create `.env.local` in repo root:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_ALLOW_REMOTE_BACKEND_IN_DEV=false
VITE_ENABLE_SIGNUP_2FA=false
```

### Backend env

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

Notes:

- Do not use `file:` SQLite URLs for this backend.
- Keep secrets only in `server/.env.local`.
- Never place backend secrets in frontend env files.

## 5. Initialize Database Schema

```powershell
npm --prefix server run db:push
```

This applies Prisma schema to your Postgres database.

## 6. Start Local Servers

Terminal A (backend):

```powershell
npm --prefix server run dev
```

Terminal B (frontend):

```powershell
npm run dev
```

## 7. Validate Auth + Persistence

### Backend health

```powershell
curl.exe -sS http://localhost:3001/health
```

### Required secret gate

```powershell
npm --prefix server run test:required-secrets
```

### Manual auth smoke test

Use your app UI or API calls to verify:

1. Sign up
2. Log out
3. Log in again
4. Confirm profile reloads from backend

## 8. Cloud Run Deployment (Existing Production Path)

From `server/`:

```powershell
npm run deploy:cloudrun
```

Then run:

```powershell
npm run check:cloudrun
```

Expected: full smoke checks pass, including `create -> current -> logout -> login`.

## 9. VS Code Workflow

- Open project root in VS Code.
- Use one terminal for `npm --prefix server run dev`.
- Use second terminal for `npm run dev`.
- Keep `.env.local` and `server/.env.local` open in split view when troubleshooting.
- Use `npm --prefix server run build` before pushing deployment changes.

