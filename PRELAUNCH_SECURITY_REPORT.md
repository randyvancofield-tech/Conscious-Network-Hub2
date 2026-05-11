# Prelaunch Security Report

Date: 2026-05-02

Status: Phase 3 zero-trust audit completed with targeted remediations.

## Executive Summary

The repository is in a stronger prelaunch security posture after Phase 2 and Phase 3. Dependency audits are clean, server-side RBAC now exists for admin access, admin actions require short-lived elevation, and role changes are persistently audited.

Phase 3 found and remediated three concrete issues:

- Wallet 2FA could be enrolled but was not enforced during password sign-in.
- Public provider discovery exposed provider email addresses.
- Future `.env.*` files were not ignored by default.

## Scans Performed

- `npm audit --audit-level=moderate`
- `npm --prefix server audit --audit-level=moderate`
- `npm --prefix contracts audit --audit-level=moderate`
- Redacted local secret-pattern scan across source files, excluding build artifacts and dependencies.
- Current git tracking check for environment files.
- Tenant-isolation review of user, social, reflection, membership, course, provider, meeting, upload, and admin route patterns.
- Auth/RBAC exploit-path review for sign-in, sessions, 2FA, admin elevation, and role changes.

## Dependency Findings

- Root package audit: 0 vulnerabilities.
- Backend package audit: 0 vulnerabilities.
- Contracts package audit: 0 vulnerabilities.

Residual risk: `npm audit` only covers known advisories available to npm and does not replace source review, runtime testing, or cloud configuration review.

## Secret Scan Findings

- No hardcoded high-confidence backend secrets were found in the scanned source tree.
- `.env.production` is tracked. Current keys are `VITE_*` public frontend configuration values, not backend secrets. Because Vite exposes `VITE_*` values to the browser bundle, this is acceptable only if those values are intentionally public.
- `.gitignore` now ignores future `.env.*` files while preserving `.env.example` style templates.

Required launch discipline:

- Do not put private API keys, database URLs, signing secrets, Stripe secrets, service account keys, or private keys in any committed env file.
- If any real secret was ever committed in repo history, rotate it. This report reviewed the current working tree, not full historical leakage.

## Tenant Isolation Review

Confirmed controls:

- Canonical backend identity is enforced through `requireCanonicalIdentity`.
- Self-owned user routes use authenticated user IDs or `enforceAuthenticatedUserMatch`.
- Reflection reads/writes/deletes verify the authenticated owner.
- Social profile/post mutations use the authenticated actor and enforce owner checks before post edits/deletes.
- Membership confirmation checks authenticated user/session ownership.
- Course enrollment uses the authenticated user, not a body-provided user ID.
- Provider request queues verify provider access and request ownership.
- Admin APIs require canonical identity, `admin` role, and elevated admin token.

Remediated during this phase:

- Public provider discovery no longer returns raw provider email addresses.
- Frontend tier access no longer treats admin dashboard as a base tier-accessible view.

Remaining risks:

- Public social/newsfeed behavior intentionally exposes public posts and public profiles. Product privacy rules should confirm this is desired.
- Provider/member directory visibility should be revisited before launch if the platform needs stricter invite-only discovery.

## Plan-Act-Reflect

Plan:

- Identify exploit paths around sign-in, session creation, user-supplied IDs, admin role changes, public discovery data, and secret handling.
- Prioritize fail-closed behavior for authentication and least-privilege behavior for public APIs.

Act:

- Added wallet 2FA enforcement during sign-in using signed identity-session credentials.
- Added a regression test proving wallet 2FA accounts do not receive a session without the second factor.
- Removed raw provider email exposure from the public provider API.
- Hardened future env-file handling in `.gitignore`.
- Preserved Phase 2 admin RBAC/elevation/audit controls.

Reflect:

- The highest-value remaining work is operational: create the first admin securely, verify production env/secrets in the cloud runtime, confirm SPA fallback behavior, and perform a live smoke test against deployed endpoints.
- A future hardening pass should add automated authorization tests for every route family, not only auth/social core loops.

## Remediated Files

- `.gitignore`
- `AGENTS.md`
- `server/src/auth/identitySession.ts`
- `server/src/routes/user.ts`
- `server/src/routes/providers.ts`
- `server/src/__tests__/signin.logic.test.ts`
- `services/tierAccess.ts`

Phase 2 RBAC/admin files remain part of the prelaunch security baseline:

- `server/src/routes/admin.ts`
- `server/src/middleware.ts`
- `server/src/auth.ts`
- `server/src/index.ts`
- `components/AdminDashboard.tsx`
- `services/sessionService.ts`
- `types.ts`
- `constants.tsx`
- `App.tsx`

## Verification

- `npm --prefix server run build`: passed.
- `npm run build`: passed.
- `npm --prefix server test`: passed.
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities.
- `npm --prefix server audit --audit-level=moderate`: passed with 0 vulnerabilities.
- `npm --prefix contracts audit --audit-level=moderate`: passed with 0 vulnerabilities.

Frontend build still reports the existing large bundle warning. This is a performance concern, not a launch-blocking security finding.

## Remaining Prelaunch Checklist

- Completed 2026-05-02: promoted `randyvancofield@gmail.com` to `admin` through a controlled Prisma script.
- Store production secrets in the deployment secret manager, not source control.
- Rotate any secret that may have appeared in git history or shared logs.
- Verify native CNH provider access, applicant status, and approved-provider sign-in flows live.
- Verify Cloud Run/static hosting rewrites deep frontend links to `index.html`.
- Perform an authenticated deployed smoke test for member, provider, and admin flows.
- Add route-level authorization regression tests for admin denial, provider queue ownership, reflection ownership, and membership status ownership.
