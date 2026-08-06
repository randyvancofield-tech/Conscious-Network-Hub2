# AGENTS.md

## Project Snapshot

Conscious Network Hub is a full-stack TypeScript application with a React + Vite frontend and an Express backend. The workspace supports member sign-in, profile persistence, provider applications, approved-provider access, administrative wallet verification, and a PWA/mobile install experience.

The active codebase uses root-level frontend entry points in App.tsx and index.tsx, shared UI in components/, browser-side helpers in services/, and the backend package in server/.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: Prisma ORM with PostgreSQL-backed persistence
- Authentication: signed session tokens, persisted session records, and wallet-based admin/provider verification
- Security: canonical identity middleware, role-aware route guards, request validation, rate limiting, audit logging, and PWA-safe install guidance
- Testing: Jest for auth, persistence, provider access, and wallet flow regression coverage
- Deployment: Render-oriented backend deployment with additional legacy deployment notes under docs/
- Contracts: Solidity package under contracts/

## Architecture

1. The frontend sends browser requests to backend routes under /api/* through fetch-based helpers.
2. services/apiClient.ts attaches the stored auth token as an Authorization header unless a caller opts out.
3. Member signup and sign-in flow through App.tsx into the user routes, which issue a canonical signed session and return user data.
4. The frontend persists session state in services/sessionService.ts and wallet flow state in services/walletProvider.ts, including pending wallet auth intents and mobile rehydration support.
5. The backend validates canonical identity before protected routes execute, with shared helpers in server/src/middleware.ts and server/src/services/sessionLifecycle.ts.
6. Provider and admin access rely on separate wallet challenge routes in server/src/routes/providerAuth.ts, while native provider controls are issued through server/src/routes/providerSession.ts.

## Current Authentication Flow Summary

- Member sign-up and sign-in: App.tsx -> POST /api/user/create and POST /api/user/signin.
- Backend user handlers live in server/src/routes/user.ts and use the shared session lifecycle helper to issue canonical sessions and auth headers.
- Session creation and failure handling are centralized in server/src/services/sessionLifecycle.ts.
- Protected routes depend on requireCanonicalIdentity and getAuthenticatedUserId from server/src/middleware.ts.
- Password recovery remains available through the user routes for member, applicant, provider, and admin accounts.
- Admin and provider wallet entry is intentionally separate from the member sign-in path:
  - Administrative access uses /api/provider/auth/admin/wallet/nonce and /api/provider/auth/admin/wallet/verify.
  - Provider wallet binding and verification use /api/provider/auth/wallet/bind/* and /api/provider/auth/wallet/*.
  - Approved providers must complete wallet verification before native provider CRM tools are unlocked.
- Wallet continuity for mobile handoff is handled in services/walletProvider.ts, which preserves provider state across reconnects and supports MetaMask deep-link recovery.
- Provider and admin sessions are persisted and refreshed through services/sessionService.ts and the backend provider session store.

## Current Refactor Baseline

- The auth flow is being hardened through additive, non-breaking refactors rather than breaking existing public routes.
- Session issuance and header handling are centralized so the create/sign-in/logout flows share one canonical path.
- Regression tests cover canonical identity enforcement, user session lifecycle, provider access guards, and wallet verification behavior.

## Current Workspace Structure

- App.tsx, index.tsx, constants.tsx, types.ts: root frontend entry points and shared app state/types
- components/: React screens and UI primitives for dashboard, membership, provider access, meetings, profile, and admin tools
- services/: browser-side API, session, wallet, cache, analytics, tier access, installation, and security helpers
- src/: frontend static assets, packaged knowledge data, and app-level resources
- server/: Express API package with Prisma schema, migrations, tests, backend routes, services, and deployment scripts
- contracts/: Solidity contract package and tooling
- docs/: architecture, privacy, security, migration, and launch notes
- public/: PWA manifest, service worker, and static assets
- .agents/: local Codex skills, plugins, and workspace guidance

## Auth and Persistence Relevant Files

- App.tsx
- services/apiClient.ts
- services/sessionService.ts
- services/walletProvider.ts
- server/src/index.ts
- server/src/middleware.ts
- server/src/auth.ts
- server/src/auth/providerToken.ts
- server/src/routes/user.ts
- server/src/routes/admin.ts
- server/src/routes/providerAuth.ts
- server/src/routes/providerSession.ts
- server/src/services/sessionLifecycle.ts
- server/src/services/persistenceStore.ts
- server/src/services/localStore.ts
- server/src/services/userSessionStore.ts
- server/src/services/providerSessionStore.ts
- server/src/services/providerAccess.ts
- server/src/services/auditTelemetry.ts
- server/prisma/schema.prisma

## Backend Route Map

- Identity and user auth: user.ts, admin.ts, identitySecurity.ts, integrity.ts
- Provider flows: providers.ts, providerAuth.ts, providerSession.ts, providerCrm.ts
- Member features: membership.ts, courses.ts, userCourses.ts, reflection.ts, social.ts, meeting.ts
- Platform services: ai.ts, immersive.ts, upload.ts

## Backend Service Map

- Persistence and sessions: persistenceStore.ts, localStore.ts, prismaClient.ts, userSessionStore.ts, providerSessionStore.ts
- Provider governance: providerAccess.ts, providerDid.ts
- Security and privacy: auditTelemetry.ts, privacyGuard.ts, sensitiveDataPolicy.ts, profileNormalization.ts, userProfilePatch.ts
- Integrations and content: openAiService.ts, vertexAiService.ts, emailService.ts, googleSheetsMirror.ts, knowledgeService.ts, socialStore.ts, uploadBlobStore.ts

## Security Conventions for AI-Assisted Development

- Treat backend identity as canonical. Protected routes should use requireCanonicalIdentity and derive the acting user from getAuthenticatedUserId(req), not from request bodies.
- Enforce tenant isolation on every route that accepts a user identifier. Use enforceAuthenticatedUserMatch for self-owned routes or explicitly verify ownership before read/write/delete.
- Role checks belong on the server. Frontend route hiding is a usability layer and must never be treated as authorization.
- Admin and provider access must remain gated by canonical identity, role checks, and wallet verification where required.
- Wallet verification must match the configured wallet addresses and should handle mobile re-entry and deep-link handoff gracefully.
- Sensitive operations should emit audit events and redact secrets, tokens, and private identifiers.
- Do not commit real secrets. Keep .env files out of source control and rely on .env.example style templates.
- Prefer additive changes that preserve existing launch paths and public route contracts while hardening the underlying auth flow.

## Codex Task

Analyze the current workspace and update this guide with a summary of the existing authentication flow, wallet-backed provider/admin access, and the current file structure.
