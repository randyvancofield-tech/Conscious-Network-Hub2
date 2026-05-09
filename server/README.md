# Conscious Network Hub Backend

This package contains the Express API for Conscious Network Hub. It owns authentication, persisted user sessions, Prisma/PostgreSQL persistence, profile and social writes, membership/payment state, uploads, AI routes, provider sessions, and integrity/security routes.

## Stack

- Runtime: Node.js + Express
- Language: TypeScript
- Database: PostgreSQL through Prisma
- Auth: custom HMAC-signed session tokens plus persisted session records
- Security middleware: Helmet, CORS allowlist, request size limits, rate limiting, route validation
- Integrations: OpenAI, Google Cloud Vertex AI, Stripe, email, blockchain RPC
- Tests: Jest integration tests

## Install

From the repository root:

```powershell
npm --prefix server install
```

Or from this directory:

```powershell
npm install
```

## Required Environment

Create `server/.env.local` from `server/.env.example`.

Minimum local runtime values:

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

Optional integration values:

- `OPENAI_API_KEY`: enables OpenAI-backed AI route responses.
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_REGION`, `VERTEX_AI_MODEL`: enable Vertex AI service initialization.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_FREE`, `STRIPE_PRICE_GUIDED`, `STRIPE_PRICE_ACCELERATED`, `STRIPE_MODE`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`: enable membership checkout and webhooks.
- `SMTP_*` / email secrets: enable email delivery when `ENABLE_EMAIL_VERIFICATION` or `ENABLE_PASSWORD_RESET` is true.
- `TWILIO_*`: enables phone 2FA delivery when `ENABLE_USER_2FA` is true.
- `HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS`, `HCN_PROFILE_ANCHOR_CHAIN_ID`, RPC keys: enable integrity anchoring.

The canonical environment reference is [docs/ENVIRONMENT_MATRIX.md](../docs/ENVIRONMENT_MATRIX.md).

## Database

Apply the Prisma schema to PostgreSQL:

```powershell
npm run db:push
```

Schema source:

- `server/prisma/schema.prisma`

Primary data access:

- `src/services/persistenceStore.ts`
- `src/services/socialStore.ts`
- `src/services/uploadBlobStore.ts`
- `src/services/userSessionStore.ts`
- `src/services/providerSessionStore.ts`

## Local Development

```powershell
npm run dev
```

The backend listens on `http://localhost:3001` by default.

Health check:

```powershell
curl.exe -sS http://localhost:3001/health
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Express with nodemon + ts-node. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run start` | Build then run `dist/index.js`. |
| `npm run db:push` | Push Prisma schema to the configured database. |
| `npm test` | Run Jest tests. |
| `npm run test:required-secrets` | Build and verify required startup secrets. |
| `npm run test:smoke` | Run local backend smoke checks against a running backend. |
| `npm run test:curl` | Backwards-compatible alias for `test:smoke`. |
| `npm run check:render` | Run post-deploy smoke checks against the current Render backend. |
| `npm run deploy:cloudrun` | Legacy Cloud Run deploy helper. Current production backend is Render. |
| `npm run check:cloudrun` | Legacy Cloud Run smoke helper. Current production backend is Render. |

## Route Map

Routes are mounted in `src/index.ts`.

| Mount | Module | Access |
|---|---|---|
| `GET /health` | `src/middleware.ts` | Public |
| `/api/user` | `src/routes/user.ts` | Public signup/signin plus protected user routes |
| `/api/membership` | `src/routes/membership.ts` | Public tiers/webhook plus protected membership routes |
| `/api/provider/auth` | `src/routes/providerAuth.ts` | Public provider auth |
| `/api/identity-security` | `src/routes/identitySecurity.ts` | Mixed route-level auth |
| `/api/integrity` | `src/routes/integrity.ts` | Mixed route-level auth |
| `/api/ai` | `src/routes/ai.ts` | Protected |
| `/api/upload` | `src/routes/upload.ts` | Protected |
| `/api/reflection` | `src/routes/reflection.ts` | Protected |
| `/api/social` | `src/routes/social.ts` | Protected |
| `/api/provider/session` | `src/routes/providerSession.ts` | Provider-session protected |
| `/api/bridge` | `src/routes/providerBridge.ts` | Provider/user bridge |
| `/api/immersive` | `src/routes/immersive.ts` | Protected |
| `/api/meeting` | `src/routes/meeting.ts` | Mixed user/provider/guest routers |
| `/uploads` | `src/routes/upload.ts` | Public upload retrieval |

## Authentication Flow

Signup:

1. Frontend calls `POST /api/user/create`.
2. `src/routes/user.ts` validates payload, password policy, and requested profile fields.
3. User/profile data is written through `persistenceStore`.
4. The route verifies persistence read-back.
5. `userSessionStore` creates a persisted session.
6. `src/auth.ts` returns a signed token containing `userId`, `sessionId`, `issuedAt`, and `expiresAt`.

Signin:

1. Frontend calls `POST /api/user/signin`.
2. Backend resolves user by email.
3. `src/auth.ts` verifies password hash.
4. User route enforces lockout and optional 2FA/provider policy.
5. A persisted session and signed token are returned.

Protected requests:

1. Frontend sends `Authorization: Bearer <token>`.
2. `requireCanonicalIdentity` in `src/middleware.ts` verifies token signature/expiry.
3. Middleware verifies the persisted session exists, belongs to the token user, is not revoked, and is not expired.
4. Route handlers use the canonical user identity from the request.

Logout:

- `POST /api/user/logout` revokes the persisted session.

## Testing

Run the standard backend checks:

```powershell
npm run build
npm test
```

Current core suites cover signin logic, auth/user persistence loops, and phase 4 privacy/social behavior.

## Deployment

Render is the current backend deployment path at `https://conscious-network-backend.onrender.com`.

See [DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md) for required secrets, shared DB schema sync, and post-release verification.

## Adding Backend Work

When adding or changing routes:

1. Add validation schemas under `src/validation/` when accepting request bodies.
2. Keep persistence writes in service/data-layer modules rather than route-local ad hoc storage.
3. Use `requireCanonicalIdentity` for user-protected routes.
4. Add focused Jest coverage when behavior touches auth, persistence, privacy, payments, or user-facing API contracts.
5. Update this README or the environment matrix if the route adds setup, env, or operational requirements.
