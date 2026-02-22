# Environment Matrix

Canonical environment values for the current backend architecture.

## Frontend

| File | Key | Default | Required | Notes |
|---|---|---|---|---|
| `.env.local` | `VITE_BACKEND_URL` | `http://localhost:3001` | Yes | Frontend API base URL. |
| `.env.local` | `VITE_ALLOW_REMOTE_BACKEND_IN_DEV` | `false` | No | Keeps development writes on local backend unless explicitly overridden. |
| `.env.local` | `VITE_ENABLE_SIGNUP_2FA` | `false` | No | Keep disabled until full OTP/provider flows are operational. |
| `.env.example` | `VITE_BACKEND_URL` | `http://localhost:3001` | Yes | Template value for local development. |

## Backend

| File | Key | Default | Required | Notes |
|---|---|---|---|---|
| `server/.env.local` | `DATABASE_URL` | `postgresql://...` | Yes | Must be PostgreSQL for runtime startup outside tests. |
| `server/.env.local` | `AUTH_PERSISTENCE_BACKEND` | `shared_db` | Yes | Required outside tests. |
| `server/.env.local` | `DATABASE_PROVIDER` | `postgresql` | No | Optional Prisma hint. |
| `server/.env.local` | `AUTH_TOKEN_SECRET` | none | Yes | Required for session signing. |
| `server/.env.local` | `SENSITIVE_DATA_KEY` | none | Yes (shared_db/prod) | Required for sensitive field encryption in shared DB/prod paths. |
| `server/.env.local` | `PORT` | `3001` | Yes | Backend listener port. |
| `server/.env.local` | `NODE_ENV` | `development` | Yes | Runtime mode. |
| `server/.env.local` | `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Yes | Strict comma-separated allowlist. |
| `server/.env.local` | `RATE_LIMIT_MAX` | `100` | No | Requests per 15 minute window. |
| `server/.env.local` | `OPENAI_API_KEY` | none | Optional | Required only for `/api/ai/*` success responses. |
| `server/.env.local` | `ADMIN_DIAGNOSTICS_KEY` | none | Optional | Enables non-local diagnostics access for `/api/user/create/diagnostics`. |

## Hardening Rules

- Do not use local-file persistence modes in runtime environments.
- Keep all non-`VITE_` secrets out of frontend environment files.
- Use `npm --prefix server run test:required-secrets` before deploy.
- Use `npm --prefix server run check:cloudrun` after deploy.

