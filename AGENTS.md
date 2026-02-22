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
- `server/src/routes/user.ts`
- `server/src/services/persistenceStore.ts`
- `server/src/services/userSessionStore.ts`
- `server/prisma/schema.prisma`

## Codex Task

"Analyze my current workspace and update AGENTS.md with a summary of the existing authentication flow and file structure."

