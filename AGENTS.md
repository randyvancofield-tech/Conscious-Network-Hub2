# AGENTS.md

## Project Snapshot

Conscious Network Hub is a full-stack TypeScript application with a React frontend and an Express backend. Authentication and user persistence are implemented in the backend with Prisma and PostgreSQL.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL via Prisma ORM
- Authentication: Custom signed session tokens + persisted session records
- Security: Helmet, CORS allowlist, request validation, rate limiting
- Testing: Jest (integration tests for core persistence/auth loops)
- Deployment: Google Cloud Run

## Architecture

1. Frontend sends requests to backend API routes (`/api/*`) using `fetch`.
2. Signup/signin calls hit backend user routes and return a signed auth token.
3. Frontend stores token in localStorage and sends it in `Authorization: Bearer ...`.
4. Backend validates token + persisted session before protected route access.
5. All user/profile/post/session writes flow through Prisma to PostgreSQL.

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
  - Enforces lockout/2FA policy
  - Creates persisted session + signed token
- Session validation middleware: `server/src/middleware.ts` (`requireCanonicalIdentity`)
- Logout endpoint: `POST /api/user/logout` revokes persisted session

## File Structure (Auth/Persistence-Relevant)

- `App.tsx`
- `services/sessionService.ts`
- `server/src/index.ts`
- `server/src/middleware.ts`
- `server/src/auth.ts`
- `server/src/auth/identitySession.ts`
- `server/src/routes/user.ts`
- `server/src/routes/admin.ts`
- `server/src/services/persistenceStore.ts`
- `server/src/services/userSessionStore.ts`
- `server/src/services/auditTelemetry.ts`
- `server/prisma/schema.prisma`

## Security Conventions For AI-Assisted Development

- Treat backend identity as canonical. Protected routes must use `requireCanonicalIdentity` and derive the acting user from `getAuthenticatedUserId(req)`, not from request bodies.
- Enforce tenant isolation on every route that accepts a user identifier. Use `enforceAuthenticatedUserMatch` for self-owned routes, or explicitly verify ownership before read/write/delete.
- Role checks belong on the server. Frontend route hiding is only a usability layer and must never be treated as authorization.
- Admin/Superuser access must require `role === 'admin'` plus a short-lived elevated admin token for administrative reads, role changes, and future destructive actions.
- Role changes must be audited through `recordAuditEvent` with actor, target, previous role, next role, and reason metadata.
- Standard members must not access admin endpoints, provider queues, provider sessions, or another user's private profile/reflection/course data.
- Provider access must remain provider-scoped. Provider request queues should verify the authenticated provider owns the queue or request before returning or mutating records.
- 2FA methods must fail closed. If `twoFactorMethod` is `phone` or `wallet`, sign-in must not create a session until the matching second factor is verified.
- Do not expose private contact data in public discovery APIs. Public provider/member listings should avoid raw email addresses, tokens, phone numbers, wallet identifiers, and secrets.
- Never commit real secrets. Keep `.env`, `.env.*`, and local production overrides out of source control; only commit `.env.example` style templates with placeholder values.
- Audit logs are persistent security records. They should redact secrets and sensitive identifiers, and new sensitive operations should emit success and denial events.
- When adding new dependencies, run the relevant `npm audit` command and prefer maintained packages with a clear need.

## Codex Task

"Analyze my current workspace and update AGENTS.md with a summary of the existing authentication flow and file structure."
