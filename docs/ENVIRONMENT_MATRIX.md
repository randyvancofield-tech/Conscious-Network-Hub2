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
| Render | `STRIPE_SECRET_KEY` | none | Yes | Live secret or restricted key for the Mercury-connected Stripe account. |
| Render | `STRIPE_WEBHOOK_SECRET` | none | Yes | Signing secret from the Render webhook endpoint. |
| Render | `STRIPE_PRICE_FREE` | none | Yes | Live $0/month Free / Community Stripe price ID. |
| Render | `STRIPE_PRICE_GUIDED` | none | Yes | Live $22/month Guided Stripe price ID. |
| Render | `STRIPE_PRICE_ACCELERATED` | none | Yes | Live $44/month Accelerated Stripe price ID. |
| Render | `STRIPE_MODE` | `live` | Yes | Must be `live` in production. |
| Render | `STRIPE_SUCCESS_URL` | `https://conscious-network.org/?checkout=success&session_id={CHECKOUT_SESSION_ID}` | Yes | Checkout success redirect. |
| Render | `STRIPE_CANCEL_URL` | `https://conscious-network.org/?checkout=cancel` | Yes | Checkout cancel redirect. |
| Render | `FRONTEND_BASE_URL` | `https://conscious-network.org` | Yes | Fallback base URL for redirects and links. |
| Render | `EMAIL_USER` + `EMAIL_PASSWORD`, or `SMTP_HOST` + `SMTP_PORT` | none | No | Deferred for launch; needed only when email verification/password reset are enabled. |
| Render | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | none | No | Deferred for launch; needed only when user phone 2FA is enabled. |
| Render | `ENABLE_EMAIL_VERIFICATION` | `false` | No | Keep unset/false for launch mode. |
| Render | `ENABLE_PASSWORD_RESET` | `false` | No | Keep unset/false for launch mode. |
| Render | `ENABLE_USER_2FA` | `false` | No | Keep unset/false for launch mode. |
| Render | `ENABLE_INITIAL_2FA` | `false` | No | Keep unset/false for launch mode. |

## Hardening Rules

- Do not use local-file persistence modes in runtime environments.
- Keep all non-`VITE_` secrets out of frontend environment files.
- Use `npm --prefix server run test:required-secrets` before deploy.
- Current Stripe webhook URL: `https://conscious-network-backend.onrender.com/api/membership/stripe/webhook`.
- Use Render logs and health checks after deploy. Legacy Cloud Run check scripts remain for historical operations only.
