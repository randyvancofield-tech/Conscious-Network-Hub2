# Cleanup Baseline

Created: 2026-04-25

This document captures the current workspace before dependency or documentation cleanup. No files were deleted or relocated during this baseline pass.

## Known-Good Verification

Run from the repository root unless noted.

| Check | Command | Result | Notes |
|---|---|---|---|
| Frontend production build | `npm run build` | Pass | Vite built successfully. Current bundle warning: main JS chunk is larger than 500 kB. |
| Backend TypeScript build | `npm --prefix server run build` | Pass | `tsc` completed successfully. |
| Backend tests | `npm --prefix server test` | Pass | 3 suites, 9 tests passed. Tests emit expected audit/auth log output. |

## Package Inventory

### Root Package

Role: frontend application plus current contract deployment script.

Runtime dependencies:

- `@mediapipe/selfie_segmentation`: used by `components/ConsciousMeetings.tsx`.
- `@react-three/drei`, `@react-three/fiber`, `three`: used by `components/ThreeScene.tsx`; `three` also used by `components/ConsciousMeetings.tsx`.
- `axios`: removed in launch cleanup after active frontend code no longer imported it.
- `ethers`: used by `components/IdentitySecurityPanel.tsx`.
- `lucide-react`: used broadly across `App.tsx`, `constants.tsx`, and components.
- `react`, `react-dom`: frontend runtime.

Development dependencies:

- `@vitejs/plugin-react`, `typescript`, `vite`, `@types/node`: frontend build/tooling.
- `prisma`: no root code reference found in this pass. Backend owns Prisma schema and runtime client.

Cleanup notes:

- Contract deployment tooling now lives under `contracts/`.
- Root `ethers` remains a frontend runtime dependency because wallet identity UI imports it.
- Root `prisma` is a candidate for removal or relocation after verifying no local workflow depends on running Prisma from the root.

### Server Package

Role: Express backend, auth, persistence, AI, payments, identity/security, uploads, and social APIs.

Runtime dependencies with observed ownership:

- `@prisma/client`: persistence stores under `server/src/services/*Store.ts`.
- `bcryptjs`, `jsonwebtoken`, `crypto` built-ins: auth/password/session flow.
- `cors`, `helmet`, `express-rate-limit`, `express`: HTTP app/security in `server/src/index.ts`.
- `dotenv`: environment loading in `server/src/index.ts`.
- `ethers`: identity/security and integrity routes.
- `multer`: upload route/blob handling.
- `nodemailer`: email service.
- `openai`, `@google-cloud/vertexai`: AI service routes.
- `stripe`: membership and webhook route.

Development dependencies:

- `jest`, `ts-jest`, `ts-node`, `nodemon`, `typescript`, `@types/*`: backend build/test/dev tooling.
- `prisma`: backend schema push and migration tooling.

## Route Ownership Map

Routes are mounted in `server/src/index.ts`.

| Mount | Route File | Access Pattern | Main Ownership |
|---|---|---|---|
| `GET /health` | `server/src/middleware.ts` | Public | Health check |
| `/api/user` | `server/src/routes/user.ts` | Public signup/signin plus protected user routes | Auth, profile, privacy/security settings |
| `/api/membership` | `server/src/routes/membership.ts` | Public webhook plus protected membership routes | Stripe checkout, subscription state, tier persistence |
| `/api/provider/auth` | `server/src/routes/providerAuth.ts` | Public provider auth | Provider DID/session challenge flow |
| `/api/identity-security` | `server/src/routes/identitySecurity.ts` | Mixed route-level auth | Wallet identity/security session utilities |
| `/api/integrity` | `server/src/routes/integrity.ts` | Mixed route-level auth | Blockchain profile anchoring/integrity verification |
| `/api/ai` | `server/src/routes/ai.ts` | Protected | OpenAI/Vertex AI chat, wisdom, summaries, issue reports |
| `/api/upload` | `server/src/routes/upload.ts` | Protected | User media upload handling |
| `/api/reflection` | `server/src/routes/reflection.ts` | Protected | Reflection CRUD and upload cleanup |
| `/api/social` | `server/src/routes/social.ts` | Protected | Social profile, posts, likes, follow, feed |
| `/api/provider/session` | `server/src/routes/providerSession.ts` | Provider session protected | Provider group/session management |
| `/api/provider/auth/session` | `server/src/routes/providerAuth.ts` | Native provider session flow | CNH-authenticated provider/admin control session |
| `/api/immersive` | `server/src/routes/immersive.ts` | Protected | Immersive interaction audit/state |
| `/api/meeting` | `server/src/routes/meeting.ts` | Mixed user/provider/guest routers | Meeting participation and provider workflows |
| `/uploads` | `server/src/routes/upload.ts` | Public | Static/upload retrieval route |

## Data Layer Ownership

- `server/src/services/persistenceStore.ts`: central Prisma-backed user/profile/privacy/membership/provider data access.
- `server/src/services/socialStore.ts`: social graph/posts persistence with Prisma.
- `server/src/services/uploadBlobStore.ts`: upload blob/object persistence with Prisma.
- `server/src/services/userSessionStore.ts`: user sessions stored through provider-session persistence records.
- `server/src/services/providerSessionStore.ts`: provider session persistence.
- `server/prisma/schema.prisma`: database schema source.

## Current Authentication Flow

Frontend:

- Signup entry: `App.tsx` `handleCreateProfile` sends `POST /api/user/create`.
- Signin entry: `App.tsx` `handleSignIn` sends `POST /api/user/signin`.
- `services/sessionService.ts` stores `hcn_auth_token` and cached user data in `localStorage`.
- `services/sessionService.ts` adds `Authorization: Bearer <token>` via `buildAuthHeaders`.

Backend:

- `server/src/routes/user.ts` validates signup/signin payloads.
- Passwords are hashed and verified via `server/src/auth.ts`.
- Signup/signin creates a persisted user session with `server/src/services/userSessionStore.ts`.
- `server/src/auth.ts` signs a compact HMAC session token containing `userId`, `sessionId`, `issuedAt`, and `expiresAt`.
- Protected routes use `server/src/middleware.ts` `requireCanonicalIdentity`, which verifies both token signature/expiry and persisted session state.
- Logout uses `POST /api/user/logout` and revokes the persisted session.

## Documentation Inventory

Recommended canonical documents:

- `README.md`: top-level "Start Here" for the full workspace.
- `SETUP_GUIDE.md`: local setup reference.
- `DEPLOYMENT_RUNBOOK.md`: deployment operations reference.
- `docs/ENVIRONMENT_MATRIX.md`: canonical environment matrix.
- `server/README.md`: backend route, auth, persistence, and operations reference.
- `server/TESTING.md`: backend testing reference.
- `AGENTS.md`: agent-facing auth, persistence, and workspace guidance.

Likely historical/archive candidates:

- `BACKEND_IMPLEMENTATION_SUMMARY.md`
- `ETHICAL_AI_ENHANCEMENT_PROPOSAL.md`
- `ETHICAL_AI_IMPLEMENTATION_COMPLETE.md`
- `ETHICAL_AI_INSIGHT_IMPLEMENTATION.md`
- `ETHICAL_AI_QUICK_REFERENCE.md`
- `ETHICAL_AI_TECHNICAL_REFERENCE.md`
- `ETHICAL_AI_USER_GUIDE.md`
- `MUSIC_BOX_GUIDE.md`
- `docs/HANDOFF_PHASE3.md`
- `docs/PROFILE_CREATION_AUDIT_REPORT.md`

Domain-specific docs to review before archiving:

- `docs/SOCIAL_API_DESIGN.md`
- `docs/PRIVACY_SETTINGS_SCHEMA.md`
- `docs/MEDIA_UPLOAD_BACKEND.md`
- `docs/BACKEND_FIELD_MAPPING.md`
- `docs/compliance/*.md`

## Cleanup Sequence Recommendation

1. Keep this baseline until the first dependency/doc cleanup lands and passes the same verification commands.
2. Move contract deployment tooling into a dedicated `contracts/tooling` or `contracts/scripts` area only after deciding whether frontend wallet identity still needs root `ethers`.
3. Remove or relocate root `prisma` only after confirming no developer command uses Prisma from the root.
4. Archive historical docs into `docs/archive/` after confirming the refreshed README path covers their durable information.
5. Add CI or local hygiene scripts after the repo boundaries are clean.

## Cleanup Log

### 2026-04-25: Root Prisma Removal

- Removed root `prisma` from `package.json` dev dependencies.
- Updated root `package-lock.json` via `npm uninstall prisma --save-dev`.
- Kept `server/package.json` Prisma dependencies unchanged because backend owns `server/prisma/schema.prisma` and `npm --prefix server run db:push`.
- Verification after removal:
  - `npm run build`: pass.
  - `npm --prefix server run build`: pass.
  - `npm --prefix server test`: pass, 3 suites and 9 tests.

### 2026-04-25: Contract Tooling Separation

- Moved contract deployment tooling from `scripts/deploy-contracts.mjs` to `contracts/tooling/deploy-contracts.mjs`.
- Added `contracts/package.json` and `contracts/package-lock.json` so Solidity deployment dependencies are owned by the contracts area.
- Updated root `deploy:contracts` to delegate to `npm --prefix contracts run deploy`.
- Removed root `solc`; root `ethers` remains because frontend wallet identity UI still imports it.
- Added `npm --prefix contracts run compile` as a non-deploy verification command.
- Corrected contracts compiler ownership to a `solc` 0.8.x package compatible with `contracts/HCNProfileAnchor.sol`.
- `npm --prefix contracts install` currently reports 2 low-severity vulnerabilities from contract tooling dependencies; no forced audit fix was applied.
- Verification after separation:
  - `npm --prefix contracts run compile`: pass.
  - `npm run build`: pass.
  - `npm --prefix server run build`: pass.
  - `npm --prefix server test`: pass, 3 suites and 9 tests.

### 2026-04-25: Canonical README Refresh

- Rewrote root `README.md` as the current "Start Here" document for the full workspace.
- Rewrote `server/README.md` around the actual backend responsibilities: auth, persisted sessions, Prisma/PostgreSQL, route map, scripts, and deployment.
- Removed stale AI-only framing, old dates, mojibake characters, and outdated React/backend descriptions from the canonical README path.
- Kept older historical/proposal docs in place for the next archive stage.
- Verification after README refresh:
  - Scan for known stale README markers: pass.
  - `npm run build`: pass.
  - `npm --prefix server run build`: pass.
  - `npm --prefix server test`: pass, 3 suites and 9 tests.
  - `npm --prefix contracts run compile`: pass.

### 2026-04-25: Documentation Archive and Root Check Script

- Created `docs/archive/`.
- Moved historical/proposal/status docs into `docs/archive/`:
  - `BACKEND_IMPLEMENTATION_SUMMARY.md`
  - `ETHICAL_AI_ENHANCEMENT_PROPOSAL.md`
  - `ETHICAL_AI_IMPLEMENTATION_COMPLETE.md`
  - `ETHICAL_AI_INSIGHT_IMPLEMENTATION.md`
  - `ETHICAL_AI_QUICK_REFERENCE.md`
  - `ETHICAL_AI_TECHNICAL_REFERENCE.md`
  - `ETHICAL_AI_USER_GUIDE.md`
  - `MUSIC_BOX_GUIDE.md`
  - `docs/HANDOFF_PHASE3.md`
  - `docs/PROFILE_CREATION_AUDIT_REPORT.md`
- Added `docs/archive/README.md` to identify archived docs as historical context, not canonical instructions.
- Added root `npm run check` to run frontend build, backend build, backend tests, and contract compile.
- Verification after archive/check script:
  - Historical-doc link scan: pass.
  - `npm run check`: pass.

### 2026-04-25: DevOps Script Standardization and CI

- Added `server/scripts/run-powershell-script.js` to launch PowerShell scripts through Node.
- Updated backend Cloud Run scripts to use the Node launcher:
  - `npm run deploy:cloudrun`
  - `npm run check:cloudrun`
- Kept the existing PowerShell deployment/check implementation intact.
- Added `.github/workflows/check.yml` to run installs plus root `npm run check` on pushes to `main`/`master` and pull requests.
- Verification after DevOps/CI updates:
  - `node --check server/scripts/run-powershell-script.js`: pass.
  - `npm run check`: pass.
  - Deployment and remote Cloud Run checks were not executed in this cleanup pass.

### 2026-04-25: Backend Smoke Test Refresh

- Reviewed remaining domain-specific docs in `docs/`; kept current social, privacy, media upload, and field mapping docs in curated docs.
- Replaced stale AI-only bash smoke script with `server/scripts/smoke-local.js`.
- Added `npm run test:smoke` and kept `npm run test:curl` as a backwards-compatible alias.
- Rewrote `server/TESTING.md` around current auth-protected behavior, Jest checks, local smoke checks, and Cloud Run checks.
- Verification after smoke-test refresh:
  - `node --check server/scripts/smoke-local.js`: pass.
  - `node --check server/scripts/run-powershell-script.js`: pass.
  - Active-doc stale marker scan: pass.
  - `npm run check`: pass.
