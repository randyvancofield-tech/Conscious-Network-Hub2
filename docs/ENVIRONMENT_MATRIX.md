# Environment Matrix

## Frontend

| File | Key | Default | Required | Notes |
|---|---|---|---|---|
| `.env.local` | `VITE_BACKEND_URL` | `http://localhost:3001` | Yes | Frontend API base URL. Must point to backend. |
| `.env.local` | `VITE_ALLOW_REMOTE_BACKEND_IN_DEV` | `false` | No | When `false`, development runtime/proxy ignores non-localhost backend URLs to prevent accidental remote auth writes. |
| `.env.local` | `VITE_ENABLE_SIGNUP_2FA` | `false` | No | Keep `false` until phone OTP delivery and wallet provider token issuance are fully operational end-to-end. |
| `.env.example` | `VITE_BACKEND_URL` | `http://localhost:3001` | Yes | Template value for local development. |

## Backend

| File | Key | Default | Required | Notes |
|---|---|---|---|---|
| `server/.env.local` | `DATABASE_URL` | `file:./prisma/dev.db` | Yes | Local dev can use file DB; Cloud Run must use shared Postgres (`postgresql://...`). |
| `server/.env.local` | `AUTH_PERSISTENCE_BACKEND` | `local_file` | Yes | `local_file` keeps JSON store for dev; set `shared_db` in Cloud Run to force shared DB-backed auth/profile persistence. |
| `server/.env.local` | `DATABASE_PROVIDER` | `sqlite` | No | Optional Prisma CLI provider hint (`postgresql` for shared DB environments). |
| `server/.env.local` | `GOOGLE_CLOUD_PROJECT` | `your-gcp-project-id` | Yes (prod), recommended (dev) | Required for Vertex AI init. |
| `server/.env.local` | `GOOGLE_CLOUD_REGION` | `us-central1` | Yes (prod) | Vertex AI region. |
| `server/.env.local` | `VERTEX_AI_MODEL` | `gemini-1.5-flash-001` | No | Override model. |
| `server/.env.local` | `PORT` | `3001` | Yes | Backend port. |
| `server/.env.local` | `NODE_ENV` | `development` | Yes | Runtime mode. |
| `server/.env.local` | `CORS_ORIGINS` | `http://localhost:3000` | Yes | Strict comma-separated allowlist. |
| `server/.env.local` | `RATE_LIMIT_MAX` | `100` | No | Requests per 15 min window. |
| `server/.env.local` | `OPENAI_API_KEY` | `your-openai-api-key` | Optional for startup, required for AI routes | Keep only in backend env, never frontend. |

## Hardening Rules Applied

- Secrets are isolated to `server/.env.local`.
- Frontend exposes only `VITE_*` values.
- CORS now enforces strict allowlist even in development.
- Local ports are standardized as frontend `3000` and backend `3001`.
- Development frontend/backend routing now defaults to local-only unless explicitly overridden.
