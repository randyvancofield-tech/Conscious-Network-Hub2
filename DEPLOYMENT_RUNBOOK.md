# Deployment Runbook

## Backend (Render)

The current live backend is Render:

`https://conscious-network-backend.onrender.com`

Use this endpoint for Stripe webhooks:

`https://conscious-network-backend.onrender.com/api/membership/stripe/webhook`

Render should be configured with environment values directly in the Render dashboard or a managed secret source. Do not commit secret values.

Required Render Stripe values:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_FREE`
- `STRIPE_PRICE_GUIDED`
- `STRIPE_PRICE_ACCELERATED`
- `STRIPE_MODE=live`
- `STRIPE_SUCCESS_URL=https://conscious-network.org/?checkout=success&session_id={CHECKOUT_SESSION_ID}`
- `STRIPE_CANCEL_URL=https://conscious-network.org/?checkout=cancel`
- `FRONTEND_BASE_URL=https://conscious-network.org`

Render should also ensure:

   - `CORS_ORIGINS=https://conscious-network.org`
   - `FRONTEND_BASE_URL=https://conscious-network.org` (used for redirects, emails, and Stripe)
   - `AUTH_TOKEN_SECRET` is set
   - `DATABASE_URL` is the Neon pooled Postgres URL, usually a `-pooler` host (not `file:`)
   - `DATABASE_POOL_MODE=transaction` or `session`, matching the Neon pooler mode
   - `SENSITIVE_DATA_KEY` is set for sensitive-field encryption
   - `AUTH_PERSISTENCE_BACKEND=shared_db`
   - `DATABASE_PROVIDER=postgresql`
   - `HSTS_ALLOWED_HOSTS` contains only the final production API/custom domain host when it differs from `FRONTEND_BASE_URL`
   - At least one live AI provider key if production AI should be generative beyond local fallback

### Required Secrets (Backend Startup)

The backend now fails startup if any required secret is missing.

- `AUTH_TOKEN_SECRET` (preferred; `SESSION_SECRET` is accepted as a legacy alias)
- `DATABASE_URL`
- `SENSITIVE_DATA_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_FREE`
- `STRIPE_PRICE_GUIDED`
- `STRIPE_PRICE_ACCELERATED`
- `STRIPE_MODE`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `FRONTEND_BASE_URL`

Optional for AI routes only:

- `OPENAI_API_KEY`
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_REGION`, `VERTEX_AI_MODEL`
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- `GROQ_API_KEY`, `GROQ_MODEL`
- `AI_ENABLE_OLLAMA`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `AI_LOCAL_FALLBACK_ENABLED`
- `AI_CRAWLER_ENABLED`, `AI_CRAWLER_INTERVAL_MS`

Production delivery integrations:

- `EMAIL_USER` + `EMAIL_PASSWORD`, or `SMTP_HOST` + `SMTP_PORT`: required in production; enables native password reset, provider applicant lifecycle, and admin notification email delivery. Normal sign-in does not require email verification gates.
- `EMAIL_FROM`: sender address for account and provider lifecycle emails.
- `ADMIN_NOTIFICATION_EMAIL`: internal recipient for provider application/admin email notifications.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: optional legacy SMS settings only. Member/provider sign-in does not require Twilio.
- `ENABLE_PASSWORD_RESET=false`: deliberately disables native password reset email flow.
- `ENABLE_USER_2FA=false`: leave disabled for launch; legacy 2FA fields are non-blocking.
- `GOOGLE_SHEETS_WEBHOOK_URL`

For Render, keep secrets in Render environment variables or a managed secret source rather than source control.

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
npm run check:render
```

Expected:

- `GET /health` with `Origin: https://conscious-network.org` returns `200`.
- `POST /api/ai/chat` without `Authorization` returns `401` (auth enforcement).
- `GET /api/membership/tiers` returns `200` (public route still accessible).
- `POST /api/user/create` with empty JSON returns `400` (profile creation validation active).
- `POST /api/user/signin` with empty JSON returns `400` (sign-in validation active).
- End-to-end auth flow succeeds: create profile -> read current user -> logout -> login.
- If `ADMIN_DIAGNOSTICS_KEY` is configured, diagnostics check confirms `shared-db://primary` as active store.

## Frontend Release Checklist

Run from repo root:

```powershell
npm run build
```

Confirm production backend target before deployment:

- Cloudflare Pages production environment variables, or an untracked local `.env.production.local`, must contain:
  - `VITE_BACKEND_URL=https://conscious-network-backend.onrender.com`

Deploy `dist/` to the current frontend host for `https://conscious-network.org` using that provider's release workflow.

## Post-release verification

1. Open `https://conscious-network.org` in a browser.
2. In AI Insight, submit a test prompt.
3. Confirm network request goes to:
   - `https://conscious-network-backend.onrender.com/api/ai/chat`
4. Confirm response status `200` and no frontend fallback message.
5. Check Render logs for latest deploy and verify absence of:
   - repeated AI provider failures when a live AI provider is expected
   - `Unexpected token` JSON parse errors
   - CORS denials for origin `https://conscious-network.org`

## Legacy Cloud Run Scripts

Cloud Run scripts remain in the repository for historical/legacy operations, but they are not the current production Stripe webhook target. Do not use the old Cloud Run URL when configuring Stripe webhooks for CNH launch.
