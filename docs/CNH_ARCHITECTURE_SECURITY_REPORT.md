# CNH Architecture Cleanup and Security Stack Report

Date: 2026-05-16

Scope: high-level launch-hardening audit of the active Conscious Network Hub codebase. This is an engineering report, not a legal compliance certification.

## A. Technical Stack Report

### Active Platform Shape

Conscious Network Hub is currently a full-stack TypeScript application:

- Frontend: React 19, TypeScript, Vite, root-level `App.tsx` and `index.tsx`.
- Frontend UI modules: `components/`.
- Frontend client services: `services/`, including API, session, cache, media, security, tier access, analytics, and backend API helpers.
- Backend: Node.js, Express, TypeScript under `server/`.
- Database: PostgreSQL through Prisma, with Neon pooled Postgres expected for production/shared runtime.
- ORM/schema: `server/prisma/schema.prisma` plus Prisma migrations.
- Runtime persistence: `server/src/services/persistenceStore.ts` is the canonical shared DB store. Local/file-style legacy naming remains in type names, but `isUsingSharedPersistence` is true.
- Deployment: Render is the active backend target. Static frontend build output is `dist/`.
- Payments: Stripe Checkout and webhooks.
- AI: Vertex AI, OpenAI, OpenRouter, Groq, Ollama, and deterministic local fallback.
- Public content index: in-process public-only AI context crawler in `server/src/services/aiContextIndex.ts`.
- Contracts: Solidity tooling remains isolated under `contracts/`.

### Frontend Architecture

The frontend owns:

- User entry, signup, signin, membership routing, dashboard, community/social surfaces, profile editing, provider entry pages, applicant status pages, admin entry, meetings, careers, and public policy views.
- API calls through `services/apiClient.ts`.
- Token and user cache through `services/sessionService.ts`.
- Frontend tier/navigation gating through `services/tierAccess.ts`.

Important distinction: frontend route hiding is usability only. Backend route authorization remains the security boundary.

### Backend Architecture

`server/src/index.ts` mounts:

- Public user routes: signup, signin, password reset.
- Protected user routes: current user, logout, profile updates, user-specific state.
- Membership routes: public tiers/webhook and protected checkout/session/status flows.
- Provider applicant routes: public application/signin plus protected applicant status.
- Provider auth/session/CRM routes: wallet-gated provider/admin controls.
- Admin routes: canonical identity, admin role, then short-lived elevation.
- AI routes: authenticated chat, wisdom, meeting summary, issue triage, status, reindex.
- Social routes: authenticated profiles, posts, follows, newsfeed.
- Upload/reflection/meeting/immersive/integrity/courses routes.

Security middleware includes Helmet, scoped HSTS, CORS allowlist, JSON body limits, rate limiting, request logging, and shared auth middleware.

### Database and ORM

Prisma/PostgreSQL is the active persistence layer. The code expects:

- `DATABASE_URL` to point to PostgreSQL.
- Production/shared DB to use Neon pooled connection strings.
- `DATABASE_POOL_MODE=session` or `transaction` to match the Neon pooler.
- One Prisma client per Node process via `server/src/services/prismaClient.ts`.

Prisma migrations include deprecated provider bridge/launch-code structures. These were preserved because database migrations and compatibility reads should not be deleted during launch hardening.

### Authentication and Session Flow

Current member flow:

1. Frontend signup calls `POST /api/user/create`.
2. Backend validates payload and password policy.
3. Backend writes the user through the persistence store.
4. Backend verifies persistence read-back.
5. Backend creates a persisted user session.
6. Backend returns a signed token containing `userId`, `sessionId`, `issuedAt`, and `expiresAt`.
7. Frontend stores the token through session service.
8. Protected routes use `requireCanonicalIdentity`, which verifies both the signed token and persisted session record.
9. Logout revokes the persisted session.

Password hashing uses bcrypt for new passwords. Legacy hash/plain compatibility remains for migration support, with `needsPasswordRehash` available.

### Membership and Stripe

Stripe is canonical for checkout and webhook events, but CNH persists membership state in Postgres:

- Protected checkout route creates Stripe Checkout sessions.
- Confirm-session route verifies the authenticated user matches Stripe session metadata.
- Webhook route uses raw body and Stripe signature verification.
- Webhook processing records idempotency markers to prevent duplicate event processing.
- User payload membership state is reconciled from persisted membership rows, not trusted solely from frontend projection fields.

### Provider and Applicant Architecture

Provider applicant flow:

- Applicants use public applicant application/signin routes.
- Applicant accounts are role `applicant`.
- Applicant status is available through protected applicant routes.
- Frontend blocks applicant accounts from member/provider/admin screens.

Approved provider flow:

- Provider account must have provider role and active provider approval state.
- Provider email/password sign-in creates canonical member session.
- Provider wallet challenge/verification is then required before provider tools unlock.
- Provider tool access uses a separate provider session token with provider scopes.
- Provider CRM routes require provider session and provider scopes.

Admin/provider CRM administration:

- Admin/founder wallet verification is separate from normal provider wallet verification.
- Provider CRM admin controls are restricted to the configured sole admin identity.

### AI Architecture

The active AI flow is:

1. Route requires canonical identity.
2. Input is sanitized/redacted.
3. Runtime guardrail context is built.
4. Platform/public context is fetched from knowledge sources and the public context index.
5. Private authenticated context is overlaid at request time only.
6. Provider chain attempts Vertex/OpenAI first when configured, then runtime providers, then local fallback.

AI provider chain:

- Vertex AI via Google Cloud env.
- OpenAI via `OPENAI_API_KEY`.
- OpenRouter via `OPENROUTER_API_KEY`.
- Groq via `GROQ_API_KEY`.
- Ollama via local or reachable Ollama endpoint.
- Local deterministic fallback for privacy-safe availability.

AI crawler:

- Indexes published courses.
- Indexes public social posts.
- Indexes public profiles only when profile visibility is not private.
- Indexes public/internal knowledge seed material.
- Redacts sensitive text before storage in the in-process index.
- Is disabled in tests unless explicitly overridden.

### Deployment and Operations

Current production backend target is Render:

- Backend URL: `https://conscious-network-backend.onrender.com`.
- Stripe webhook target: `https://conscious-network-backend.onrender.com/api/membership/stripe/webhook`.
- Current frontend domain: `https://conscious-network.org`.

Cloud Run scripts remain as legacy helpers only. They were not deleted because they may still be useful for historical operations or disaster recovery, but documentation now labels Render as the active production path.

### Cleanup Performed

Code/config cleanup:

- Removed `base44/functions/providerLaunch/function.jsonc`, an incomplete and unreferenced Base44 provider-launch stub.
- Removed `higherconscious.network` from default backend CORS origins in `server/src/index.ts`.
- Scoped default localhost CORS origins to non-production runtime only.
- Updated `src/knowledge/hcn_scope.json` official URL to `https://conscious-network.org`.
- Updated backend package description to reflect the full backend scope, not only Vertex/Gemini.
- Updated Dockerfile comment away from Cloud Run-only wording.
- Updated Render/deployment/testing docs away from WordPress/higherconscious as the active frontend flow.
- Documented the expanded AI provider/env stack.

Files changed:

- `DEPLOYMENT_RUNBOOK.md`
- `README.md`
- `SETUP_GUIDE.md`
- `docs/ENVIRONMENT_MATRIX.md`
- `server/Dockerfile`
- `server/README.md`
- `server/TESTING.md`
- `server/package.json`
- `server/scripts/deploy-cloudrun.ps1`
- `server/scripts/post-deploy-check.ps1`
- `server/src/index.ts`
- `src/knowledge/hcn_scope.json`
- `docs/CNH_ARCHITECTURE_SECURITY_REPORT.md`

Files deleted:

- `base44/functions/providerLaunch/function.jsonc`

Legacy systems preserved:

- Cloud Run scripts, marked legacy.
- Archived docs, retained as historical records.
- Deprecated Prisma provider bridge/launch-code columns/tables, retained for migration compatibility.
- Legacy password verification support, retained for existing accounts.
- Legacy SMS/Twilio env references, retained as optional non-blocking settings.
- Provider CRM legacy admin migration helpers, retained because they protect the current sole-admin migration boundary.

Items intentionally left untouched:

- User signup/signin/session flow.
- Membership/Stripe checkout and webhook logic.
- Provider applicant application/status flow.
- Provider wallet verification.
- Admin wallet/elevation paths.
- Prisma schema/migrations.
- AI chat/status/reindex/crawler behavior.
- Existing archived audit reports.

## B. Security Stack Report

### Authentication Controls

Security controls currently present:

- Password policy: minimum 12 characters, uppercase, lowercase, number, symbol, and email-fragment rejection.
- Password fingerprint reuse protection.
- Bcrypt hashing for new passwords.
- Lockout after repeated failed sign-in attempts.
- HMAC-signed session tokens.
- Persisted session records.
- Session revocation on logout.
- Protected routes derive identity from `requireCanonicalIdentity`, not request body user IDs.
- Self-owned routes use canonical user matching where implemented.

Residual risk:

- Legacy password/plain hash compatibility remains. It is useful for migration but should be phased out after all active users have bcrypt hashes.

### Session and Token Handling

Controls:

- Session tokens include user ID, session ID, issue time, and expiry.
- Token signature is timing-safe compared.
- Persisted session must exist, match the user, not be revoked, and not be expired.
- `AUTH_TOKEN_SECRET` or legacy `SESSION_SECRET` is required at startup.
- Production/shared DB requires `SENSITIVE_DATA_KEY`.

### Role-Based Access Control

Controls:

- Admin routes require canonical identity, admin role, and then short-lived admin elevation.
- Provider session routes require provider session token and provider scopes.
- Provider access checks ensure provider role, approved status, not revoked.
- Applicant frontend routing restricts applicant users to provider application/status surfaces.

Needs CTO review:

- Several member backend routes, including social/AI/course enrollment surfaces, use canonical identity but not an explicit `role !== applicant` guard. The frontend blocks applicant access, and provider/admin-specific routes are protected, but backend member-surface role exclusion should be added if applicant accounts must be strictly API-isolated from all member surfaces.

### Admin and Elevated Access

Controls:

- `/api/admin` mounts canonical identity and admin role before any admin action.
- `/api/admin/elevate` requires account password or configured elevation code.
- Elevated admin token is short-lived and can bind to the current session.
- Sensitive admin operations use `requireAdminElevation`.
- Admin role changes are audited and self-role changes are denied.
- Provider CRM admin controls require the configured sole admin account.

### 2FA and Verification Boundaries

Controls:

- User 2FA fields and endpoints exist.
- User wallet 2FA enrollment is deferred unless `ENABLE_USER_2FA` is enabled.
- Provider/admin wallet verification is active and separate from ordinary member 2FA.
- Provider wallet challenge verification uses nonce, expiration, replay checks, wallet match, and signature recovery.

Needs CTO review:

- Initial member 2FA is not currently enforced: `App.tsx` `requiresInitialTwoFactorSetup` returns false, and `POST /api/user/create` creates users with `twoFactorMethod: 'none'` and null initial 2FA timestamps. This preserves current launch access but does not meet a strict "2FA required at initial setup" posture.

### Provider Approval and Wallet Boundaries

Controls:

- Provider approval state must be active.
- Provider session creation for ordinary providers is denied until wallet verification succeeds.
- Provider wallet must belong to the authenticated provider user.
- Wallet signature does not grant broad canonical access by itself; it mints provider-scoped session claims.
- Provider session middleware verifies session record, expiry, revocation, DID binding, provider role, and active provider status.
- Admin can receive broad provider scope only through admin-specific control paths.

### Applicant Boundaries

Controls:

- Applicant account role is separate from provider role.
- Applicant status route is separate from provider session/CRM routes.
- Provider wallet nonce denies applicant role.
- Frontend blocks applicant accounts from standard member/provider/admin surfaces.

Needs hardening:

- Add backend `requireRole('user', 'provider', 'admin')` or equivalent to member-only routes if direct API calls from applicant tokens must be blocked universally.

### AI Data Boundaries

Verified:

- Private user profile data is not inserted into the in-process global AI index.
- Public crawler/indexing uses published courses, public social posts, and public profiles only.
- Public profile crawling respects `profileVisibility !== 'private'`.
- Indexed text is redacted through `redactSensitiveText`.
- Private personalization is added only at authenticated request time through a small profile context layer.
- AI status/reindex routes are protected by canonical identity.

Residual risk:

- Authenticated request-time personalization can be sent to external AI providers if external providers are enabled. The current private context is intentionally narrow, but production should disclose this clearly in AI transparency language and provider contracts.
- Public profile consent is currently tied to profile visibility. More granular "allow AI indexing" controls could be added later.

### Redaction and Safety Policy

Controls:

- AI redaction removes emails, phone-like numbers, wallet addresses, and common secret/token patterns.
- AI system prompt forbids revealing secrets, raw contact data, tokens, private reflections, private posts, and private profile details.
- Crisis/sensitive classification steers responses away from diagnosis/prescription and toward qualified help.
- Trusted compliance references are included for GDPR, HIPAA Security Rule, EU AI Act, and NIST AI RMF context.

### Environment and Secret Handling

Controls:

- Startup fails for required auth, DB, sensitive data, and Stripe env values.
- Production requires `STRIPE_MODE=live`.
- Production/shared DB requires sensitive field encryption key.
- Env examples use placeholders only.
- Local `.env` files are not included in this report and should remain uncommitted.

Required follow-up:

- Render should update `CORS_ORIGINS` to `https://conscious-network.org` unless another production origin is deliberately approved.
- Render should ensure one live AI provider key is configured if generative AI beyond fallback is required.
- Render should keep `AI_ENABLE_OLLAMA=false` unless a reachable Ollama service is intentionally provisioned.

### CORS, CDN, and Transport

Controls:

- Default backend CORS origins now include `https://conscious-network.org` in production and localhost dev origins only outside production.
- Additional origins must be explicit in `CORS_ORIGINS`.
- Helmet is enabled.
- HSTS is scoped to production HTTPS requests for configured hosts.
- Provider applicant transport can require HTTPS/TLS 1.3 when enabled.

Needs operations review:

- No Cloudflare configuration is present in the repo. Cloudflare DNS/CDN/WAF/bot/rate-limit settings must be verified in the Cloudflare dashboard.
- Confirm Cloudflare TLS mode is full/strict, HTTP-to-HTTPS redirect is on, and any WAF rules do not block Stripe webhooks or Render health checks.

### Neon/Postgres Persistence Protections

Controls:

- Startup validates Postgres URL shape for shared DB.
- Production/Neon expects pooled URL.
- `DATABASE_POOL_MODE` must match pooler mode.
- Sensitive fields such as phone number and wallet DID are protected through AES-256-GCM envelope encryption when shared/prod enforcement is active.

### Stripe Integrity Controls

Controls:

- Webhook route uses raw body before JSON parser.
- Stripe webhook signature is verified.
- Event idempotency is tracked.
- Checkout session confirmation verifies authenticated user matches session metadata.
- Membership state is persisted and reconciled from backend rows.

### Diagnostics and Admin Endpoint Protections

Controls:

- `/health` is public and rate-limit-exempt.
- Admin diagnostics, where configured, require a diagnostics key.
- Admin routes require canonical identity, admin role, and elevation.
- Provider CRM admin controls require sole admin identity.

## Sensitive Boundary Verification Matrix

| Boundary | Current Status | Notes |
|---|---|---|
| Private profile data should not enter global AI index | Pass | Global crawler uses public profiles only and redacts text. |
| Public indexing should only use public/redacted content | Pass with review | Public posts/profiles/courses are indexed; add granular AI-index consent later. |
| AI personalization only at authenticated request time | Pass | `buildUserProfileContext` is request-time only and not stored in index. |
| Applicant accounts should not reach member/provider/admin surfaces | Partial | Provider/admin surfaces are protected; backend member surfaces need explicit applicant exclusion if strict isolation is required. |
| Approved provider access separate from applicant access | Pass | Provider access requires role, approval, and active status. |
| Admin access separate from provider/member access | Pass | Admin requires role and elevation; provider CRM admin requires sole admin. |
| Wallet verification should not grant broad access | Pass | Provider wallet grants provider-scoped session; admin wallet is separate and intentionally elevated. |
| Stripe membership canonical beyond frontend projection | Pass | Membership rows/webhooks/reconciliation are backend-owned. |
| 2FA part of initial account setup | Needs review | Current launch code defers member 2FA and does not enforce initial setup. |

## Risks Discovered

- Member 2FA initial setup is deferred/not enforced.
- Applicant accounts may still call some member-authenticated backend routes directly unless backend role exclusions are added.
- Cloudflare security posture is not represented in code and must be checked in dashboard.
- Legacy password compatibility should be retired after migration.
- `multer` 1.x LTS is still used for uploads; plan an upgrade path to Multer 2.x or another maintained upload parser.
- Frontend build emits a large chunk warning; consider code splitting after focus-group launch.
- AI knowledge/internal docs should be periodically reviewed so archived or obsolete wording does not leak into platform responses.

## Recommended Next Cleanup Tasks

1. Add explicit backend role guards for member-only routes to exclude `applicant` where appropriate.
2. Decide whether initial member 2FA should be enforced before broader launch; implement only after founder/CTO approval because it changes login onboarding.
3. Add an AI indexing consent flag separate from public profile visibility.
4. Move legacy Cloud Run scripts into `docs/archive` or `server/scripts/legacy` after confirming no disaster-recovery dependency.
5. Review archived docs and remove them from AI knowledge ingestion if they are no longer authoritative.
6. Upgrade upload middleware away from Multer 1.x LTS.
7. Add frontend code splitting to reduce the production bundle warning.
8. Add a documented Cloudflare runbook with TLS, WAF, bot, rate-limit, and cache settings.

## Verification Results

Commands run after cleanup:

- `npm --prefix server run build`: passed.
- `npm --prefix server test`: passed, 6 suites and 46 tests.
- `npm run build`: passed. Vite reported the existing large chunk warning.
- `git diff --check`: passed. Git reported CRLF normalization warnings only.

## Required Environment Follow-Up

Render:

- Ensure `CORS_ORIGINS=https://conscious-network.org` unless more origins are intentionally approved.
- Ensure Stripe live keys, price IDs, webhook secret, success/cancel URLs, and `STRIPE_MODE=live` are set.
- Ensure `DATABASE_URL` is the Neon pooled Postgres URL.
- Ensure `DATABASE_POOL_MODE` matches the Neon pooler mode.
- Ensure `AUTH_PERSISTENCE_BACKEND=shared_db`.
- Ensure `SENSITIVE_DATA_KEY` is present.
- Configure at least one live AI provider if production AI should be generative beyond local fallback.

Cloudflare:

- Confirm `conscious-network.org` points to the frontend release.
- Confirm TLS mode, HSTS/HTTPS redirect policy, WAF, bot rules, cache behavior, and CORS compatibility.

Neon/Postgres:

- Confirm pooled connection string in Render.
- Confirm schema is current with Prisma migrations/db push policy.
- Confirm backups/restore expectations.

Stripe:

- Confirm webhook endpoint is Render, not legacy Cloud Run.
- Confirm webhook signing secret matches Render endpoint.
- Confirm live price IDs map to CNH tiers.
