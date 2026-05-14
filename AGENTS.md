# AGENTS.md

## Project Snapshot

Conscious Network Hub is a full-stack TypeScript application with a React + Vite frontend and an Express backend. Authentication and user persistence are implemented in the backend with signed session tokens, persisted session records, Prisma, and PostgreSQL.

This checkout is not the Base44-style `entities/` + `src/App.jsx` layout. The active app uses root-level `App.tsx`/`index.tsx`, root `components/` and `services/`, and a separate `server/` package.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL via Prisma ORM
- Authentication: Custom signed session tokens + persisted session records
- Security: Helmet, CORS allowlist, request validation, rate limiting
- Testing: Jest (integration tests for core persistence/auth loops)
- Deployment: Render backend currently; legacy Google Cloud Run scripts/docs may still exist
- Contracts: Solidity contract package under `contracts/`
- Provider launch support: native CNH provider applicant/auth/admin routes; Base44 launch material is deprecated and not part of active flows

## Architecture

1. Frontend sends requests to backend API routes (`/api/*`) using `fetch`.
2. `services/apiClient.ts` attaches the stored auth token as `Authorization: Bearer ...` unless a caller opts out.
3. Signup/signin calls hit backend user routes and return a signed auth token plus canonical user data.
4. Frontend session state is managed in `services/sessionService.ts` using localStorage-backed token and user cache keys.
5. Backend validates the signed token plus persisted session before protected route access.
6. User/profile/post/session/provider writes flow through backend services, with Prisma/PostgreSQL as the canonical persistent store.

## Naming Conventions

- Variables/functions: `camelCase`
- Types/interfaces/classes: `PascalCase`
- Constants/env keys: `UPPER_SNAKE_CASE`
- Route files/services: concise descriptive names (e.g., `user.ts`, `persistenceStore.ts`)

## Current Authentication Flow Summary

- Signup frontend entry: `App.tsx` (`handleCreateProfile`) -> `POST /api/user/create`
- Signup backend handler: `server/src/routes/user.ts`:
  - Validates payload and password policy
  - Creates user in persistence store
  - Verifies persistence read-back
  - Creates persisted user session
  - Returns signed token + canonical user payload
- Signin frontend entry: `App.tsx` (`handleSignIn`) -> `POST /api/user/signin`
- Signin backend handler: `server/src/routes/user.ts`:
  - Resolves user by email
  - Verifies password hash
  - Enforces password lockout and provider/admin role rules without phone, SMS, email-code, or email-link verification gates in the default launch path
  - Creates persisted session + signed token
- Password recovery: `POST /api/user/password-reset/request` sends native reset links for user/applicant/provider/admin accounts, and `POST /api/user/password-reset/confirm` rotates the password and revokes active sessions
- Token creation/verification helpers: `server/src/auth.ts` (`createSessionToken`, `verifySessionToken`)
- Persisted session store: `server/src/services/userSessionStore.ts`, backed by local/persistence store implementations
- Session validation middleware: `server/src/middleware.ts` (`requireCanonicalIdentity`)
- Protected-route identity helpers: `getAuthenticatedUserId(req)` and `enforceAuthenticatedUserMatch(...)`
- Logout endpoint: `POST /api/user/logout` revokes the active persisted session
- Admin elevation: `server/src/routes/admin.ts` requires canonical identity, admin role, password verification, and short-lived elevation token checks for sensitive operations
- Provider auth is separate from member auth: approved providers sign in with email/password for a canonical user session, then native provider session routes in `server/src/routes/providerAuth.ts` and `providerSession.ts` initialize provider-scoped controls.

## Current Workspace Structure

- `App.tsx`, `index.tsx`, `constants.tsx`, `types.ts`: root frontend entry and shared app types/constants
- `components/`: React UI screens and shared UI primitives
- `services/`: browser-side API, session, cache, analytics, tier access, security, and platform data helpers
- `src/assets/`: frontend static assets such as brand imagery
- `src/knowledge/`: packaged knowledge data used by the app
- `server/`: Express API package, Prisma schema/migrations, tests, deployment scripts, backend services, and routes
- `contracts/`: Solidity contract package and deployment/compile tooling
- Base44 provider launch scaffolds have been removed from the active workspace; native CNH provider application and review routes are authoritative
- `docs/`: architecture, privacy, compliance, cleanup, backend mapping, and archived implementation notes
- `public/`: public images and video assets
- `.agents/`: local Codex skills/plugins and agent configuration

## Auth/Persistence-Relevant Files

- `App.tsx`
- `services/apiClient.ts`
- `services/sessionService.ts`
- `server/src/index.ts`
- `server/src/middleware.ts`
- `server/src/auth.ts`
- `server/src/auth/identitySession.ts`
- `server/src/auth/providerToken.ts`
- `server/src/routes/user.ts`
- `server/src/routes/admin.ts`
- `server/src/routes/providerAuth.ts`
- `server/src/routes/providerSession.ts`
- `server/src/services/persistenceStore.ts`
- `server/src/services/localStore.ts`
- `server/src/services/userSessionStore.ts`
- `server/src/services/providerSessionStore.ts`
- `server/src/services/providerAccess.ts`
- `server/src/services/auditTelemetry.ts`
- `server/prisma/schema.prisma`

## Backend Route Map

- Identity/auth/user: `user.ts`, `admin.ts`, `identitySecurity.ts`, `integrity.ts`
- Provider flows: `providers.ts`, `providerAuth.ts`, `providerSession.ts`
- Member features: `membership.ts`, `courses.ts`, `userCourses.ts`, `reflection.ts`, `social.ts`, `meeting.ts`
- Platform services: `ai.ts`, `immersive.ts`, `upload.ts`

## Backend Service Map

- Persistence/session: `persistenceStore.ts`, `localStore.ts`, `prismaClient.ts`, `userSessionStore.ts`, `providerSessionStore.ts`
- Provider governance: `providerAccess.ts`, `providerDid.ts`
- Security/privacy: `auditTelemetry.ts`, `privacyGuard.ts`, `sensitiveDataPolicy.ts`, `profileNormalization.ts`, `userProfilePatch.ts`
- Integrations/content: `openAiService.ts`, `vertexAiService.ts`, `emailService.ts`, `googleSheetsMirror.ts`, `knowledgeService.ts`, `socialStore.ts`, `uploadBlobStore.ts`

## Security Conventions For AI-Assisted Development

- Treat backend identity as canonical. Protected routes must use `requireCanonicalIdentity` and derive the acting user from `getAuthenticatedUserId(req)`, not from request bodies.
- Enforce tenant isolation on every route that accepts a user identifier. Use `enforceAuthenticatedUserMatch` for self-owned routes, or explicitly verify ownership before read/write/delete.
- Role checks belong on the server. Frontend route hiding is only a usability layer and must never be treated as authorization.
- Admin/Superuser access must require `role === 'admin'` plus a short-lived elevated admin token for administrative reads, role changes, and future destructive actions.
- Role changes must be audited through `recordAuditEvent` with actor, target, previous role, next role, and reason metadata.
- Standard members must not access admin endpoints, provider queues, provider sessions, or another user's private profile/reflection/course data.
- Provider access must remain provider-scoped. Provider request queues should verify the authenticated provider owns the queue or request before returning or mutating records.
- Default member/provider launch sign-in must not require phone, SMS, email-code, email-link, or 2FA verification unless explicitly redesigned. Legacy 2FA/database fields may remain, but they must stay non-blocking for normal authenticated access.
- Do not expose private contact data in public discovery APIs. Public provider/member listings should avoid raw email addresses, tokens, phone numbers, wallet identifiers, and secrets.
- Never commit real secrets. Keep `.env`, `.env.*`, and local production overrides out of source control; only commit `.env.example` style templates with placeholder values.
- Audit logs are persistent security records. They should redact secrets and sensitive identifiers, and new sensitive operations should emit success and denial events.
- When adding new dependencies, run the relevant `npm audit` command and prefer maintained packages with a clear need.

## Codex Task

"Analyze my current workspace and update AGENTS.md with a summary of the existing authentication flow and file structure."
