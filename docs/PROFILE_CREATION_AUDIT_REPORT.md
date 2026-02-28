# Profile Creation Audit Report
Date: February 18, 2026

## Scope
- Frontend signup path in `App.tsx` (`Membership Access` -> signup modal).
- Backend profile creation API `POST /api/user/create` in `server/src/routes/user.ts`.
- Downstream persistence and mirrors (local store, uploads, optional webhook mirror).

## Executive Findings
1. Historical root cause for the original `"Failed to create user profile"` failure:
   - Prisma runtime engine incompatibility on Windows ARM64.
   - Impact: any DB write failed during signup and returned a generic 500.
2. Secondary reliability risk found during this audit:
   - If `server/data/runtime-store.json` was corrupted/partially written, signup could still fail.
   - This has now been corrected with atomic writes, backup recovery, and explicit 503 behavior.
3. Expected non-500 signup rejections (working as designed):
   - Password policy violations return `400`.
   - Duplicate email returns `409`.
   - Storage unavailable now returns `503` with explicit message.

## Corrective Actions Implemented
- Replaced Prisma dependency for signup-critical persistence with local store service:
  - `server/src/services/localStore.ts`
- Hardened store persistence:
  - Atomic save via temp file + rename.
  - Automatic recovery from backup file when primary store is unreadable.
  - Explicit typed storage error (`STORE_UNAVAILABLE`) for non-recoverable cases.
- Improved API failure clarity:
  - `POST /api/user/create` now returns `503` with a clear message when storage is unavailable.

## Validation Results
Performed on isolated backend instance (port `4011`) to avoid stale process interference.

- Baseline signup (healthy store): `200` success.
- Corrupted primary store + valid backup: `200` success (recovered from backup).
- Corrupted primary store + corrupted backup: `503` with explicit storage-unavailable error.

## Data Flow: Where Profile Data Goes
### 1) Account Creation Request
- Source: frontend signup modal in `App.tsx`.
- API: `POST /api/user/create`.
- Payload fields: `email`, `name`, `password`, optional `twoFactorMethod`, `phoneNumber`, `walletDid`.

### 2) Backend Persistence
- Primary destination: `server/data/runtime-store.json`.
- Backup destination: `server/data/runtime-store.backup.json`.
- Stored profile fields include:
  - `id`, `email`, `name`, password hash, password fingerprint.
  - Tier/subscription metadata.
  - 2FA metadata (`twoFactorMethod`, phone/wallet enrollment fields, OTP tracking fields).
  - Timestamps (`createdAt`, `updatedAt`).

### 3) Optional External Mirror
- Function: `mirrorUserToGoogleSheets` in `server/src/services/googleSheetsMirror.ts`.
- Trigger: after successful profile creation.
- Destination: URL from `GOOGLE_SHEETS_WEBHOOK_URL` (if configured).
- Mirrored fields: `userId`, `email`, `name`, `tier`, `createdAt`, `mirroredAt`.

### 4) Session + Browser Storage
- Auth token key: `hcn_auth_token` (`services/sessionService.ts`).
- User cache key: `hcn_active_user` (`services/sessionService.ts`).
- Optional identity session key: `hcn_identity_security_session_v1` (`components/IdentitySecurityPanel.tsx`).

### 5) Related User Content Paths
- Profile/reflection file uploads:
  - Files saved under `server/public/uploads/*`.
  - URLs persisted in profile/reflection records.
- Membership/payment/provider session metadata:
  - Persisted in the same local store JSON.

## Operational Notes
- Multiple long-running Node processes can serve stale backend code on different ports and cause inconsistent behavior.
- For deterministic verification, run a single backend instance and confirm `/health` before testing signup.

## Current Status
- The profile creation failure path has been corrected.
- Signup now fails with explicit, actionable responses for all audited failure classes.
