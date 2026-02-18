# Deployment Runbook

## Backend (Cloud Run)

Run from `server/`:

```powershell
npm run deploy:cloudrun
```

This script:

1. Deploys current backend source to `conscious-network-backend`.
2. Updates env vars with `--update-env-vars` (does not clear unrelated vars).
3. Ensures:
   - `CORS_ORIGINS=https://conscious-network.org,http://localhost:5173`
   - `AUTH_TOKEN_SECRET` is set
   - `DATABASE_URL` is a shared Postgres URL (not `file:`)
   - `AUTH_PERSISTENCE_BACKEND=shared_db`
   - `DATABASE_PROVIDER=postgresql`
   - `OPENAI_API_KEY` (optional; required only for `/api/ai/*` routes)
4. Routes 100% traffic to latest revision.
5. Runs post-deploy checks.

### Required Secrets (Backend Startup)

The backend now fails startup if any required secret is missing.

- `AUTH_TOKEN_SECRET` (preferred; `SESSION_SECRET` is accepted as a legacy alias)
- `DATABASE_URL`

Optional for AI routes only:

- `OPENAI_API_KEY`

Other high-risk secrets referenced in code (set only if those integrations are enabled):

- `EMAIL_PASSWORD`, `SMTP_PASSWORD`
- `GOOGLE_SHEETS_WEBHOOK_URL`

For Cloud Run, provide secrets via Secret Manager-backed environment variables rather than plain text env values whenever possible.

### Shared DB schema sync (required for auth/profile persistence)

Run from `server/` before first production cutover to shared DB:

```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?schema=public"
$env:DATABASE_PROVIDER="postgresql"
npx prisma db push
```

This applies the current schema used by `server/src/services/persistenceStore.ts` (users, memberships, payments, reflections, provider sessions/challenges) without changing API routes.

### Backend checks only

```powershell
npm run check:cloudrun
```

Expected:

- `GET /health` with `Origin: https://conscious-network.org` returns `200`.
- `POST /api/ai/chat` without `Authorization` returns `401` (auth enforcement).
- `GET /api/membership/tiers` returns `200` (public route still accessible).
- `POST /api/user/create` with empty JSON returns `400` (profile creation validation active).
- `POST /api/user/signin` with empty JSON returns `400` (sign-in validation active).
- If `ADMIN_DIAGNOSTICS_KEY` is configured, diagnostics check confirms `shared-db://primary` as active store.

## Frontend Release Checklist

Run from repo root:

```powershell
npm run build
```

Confirm production backend target before deployment:

- `.env.production` must contain:
  - `VITE_BACKEND_URL=https://conscious-network-backend-181936518282.us-central1.run.app`

Deploy `dist/` to the hosting provider for `conscious-network.org` using that provider's release workflow.

## Post-release verification

1. Open `https://conscious-network.org` in a browser.
2. In AI Insight, submit a test prompt.
3. Confirm network request goes to:
   - `https://conscious-network-backend-181936518282.us-central1.run.app/api/ai/chat`
4. Confirm response status `200` and no frontend fallback message.
5. Check Cloud Run logs for latest revision and verify absence of:
   - `OPENAI_API_KEY is not set` (when AI routes are expected to be enabled)
   - `Unexpected token` JSON parse errors
   - CORS denials for origin `https://conscious-network.org`
