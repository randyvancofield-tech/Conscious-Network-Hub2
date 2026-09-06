# Internal correspondence completion review

Prepared September 6, 2026. Changes are deliberately uncommitted and unpushed for Randy's review. No production data, credentials, account decisions or messages were changed.

1. **Repository assessment.** Traced actual routes and callers across support/contact, issue reporting, application submission, applicant follow-up, administrative status changes, notifications, account recovery, provider/member navigation and private documents. The complete flow matrix is in [INTERNAL_CORRESPONDENCE.md](INTERNAL_CORRESPONDENCE.md).

2. **Existing systems.** Reused AdminMessage, Notification, sensitive-text encryption, canonical sessions, audit events and private PostgreSQL upload objects. Kept operational CRM/social/meeting records in their existing domains. Preserved admin intake notes, priority and resolution controls.

3. **Implemented architecture.** One mailbox domain with a shared backend store/router and React component. Canonical user IDs determine delivery; JSON metadata adds thread, attachment and per-reader state without new tables. Historical applicant notices are projected readably without migration. Linked new notifications do not duplicate mailbox records.

4. **Admin correspondence.** /admin ? Messages & Reports contains the shared mailbox, compose/recipient search, Inbox, Sent, History, replies, private attachments and text thread downloads. Recipient search includes account role and provider approval status. Existing intake triage remains in a disclosure. Status decisions and approvals remain in admin review.

5. **Applicant correspondence.** /provider/application-status embeds the same Mailbox, replacing the separate text box. Applicants receive, reply, initiate to administration, attach/download documents and retain history without provider approval. The old follow-up endpoint remains compatible. Admin preview remains sample-only and cannot send/download.

6. **Provider correspondence.** HCN Mailbox is available in signed-in navigation at /mailbox. Ordinary providers communicate with administration, not arbitrary peers. Provider CRM still uses existing wallet/approval gates.

7. **Member/user correspondence.** The same /mailbox view is available independently of membership tier. Ordinary users' directory contains only HCN Administration. No second login or mailbox provisioning step.

8. **Lifecycle continuity.** Approval keeps the same user ID; new mail, old follow-ups and historical lifecycle notices remain accessible. The mailbox-only allowlist also accommodates inactive/rejected providers. No duplicate accounts are created.

9. **Attachments.** Reuses private PostgreSQL blobs: up to three PDF/PNG/JPEG/UTF-8 text files, 5 MB each, extension/MIME/signature checks and sanitized names. Mail DTOs never expose object keys. Recipient download verifies message participation and attachment association, then forces download with nosniff/sandbox headers. A lost database acknowledgement is reconciled before cleanup to avoid deleting a delivered attachment. No malware-scanning guarantee is claimed.

10. **Download/export.** Download individual attachments and readable UTF-8 threads containing subject, sender, recipient, date, references and attachment names. History is paginated. Bulk mailbox/ZIP export is deferred; threads above 1,000 messages return an explicit size error.

11. **Permissions/security.** Canonical identity remains authoritative; server checks ownership on list/read/reply/state/download/export. All canonical admins share the administrative correspondence space deliberately and actions are audited. Anonymous contact email never grants mailbox ownership. Private administrative notes and credential-bearing records are excluded. The only middleware change is the explicitly approved mailbox method/path allowlist. App.tsx and the mixed-purpose admin/providerApplicants routes changed only for correspondence/navigation; user.ts, auth modules, wallet/session/password/recovery logic and Prisma schema did not change.

12. **External email.** Removed core SMTP calls from support, issue reporting, applicant submission and review updates; removed unused issue sender and provider email templates. Retained Gmail transport/configuration and the exact existing password-recovery template/route. No SMTP success is claimed. Render settings were untouched. Updated deployment, launch and applicant guidance so SMTP is not presented as a prerequisite for core correspondence. Jessica's skipped external follow-up remains unresent; inspect retained portal history before deliberately sending anything missing.

13. **Every changed/new file.** Inventory follows; temporary browser fixtures/profile/screenshots and the local preview server were removed/stopped.

- `App.tsx`
- `DEPLOYMENT_RUNBOOK.md`
- `components/AdminDashboard.tsx`
- `components/AdminProviderApplicantsPage.tsx`
- `components/Dashboard.tsx`
- `components/Mailbox.tsx`
- `components/ProviderApplicationStatusPage.tsx`
- `constants.tsx`
- `docs/APPLICANT_PORTAL_OPERATIONS.md`
- `docs/GMAIL_EMAIL.md`
- `docs/INTERNAL_CORRESPONDENCE.md`
- `docs/INTERNAL_CORRESPONDENCE_REVIEW.md`
- `docs/PHASE3_DATA_STORAGE_ADMIN_ACCESS_MAP.md`
- `docs/launch/PHASE_CONTINUITY_REGISTER.md`
- `server/.env.example`
- `server/README.md`
- `server/src/__tests__/canonicalIdentity.middleware.test.ts`
- `server/src/__tests__/mailbox.integration.test.ts`
- `server/src/index.ts`
- `server/src/middleware.ts`
- `server/src/routes/admin.ts`
- `server/src/routes/ai.ts`
- `server/src/routes/mail.ts`
- `server/src/routes/providerApplicants.ts`
- `server/src/routes/support.ts`
- `server/src/services/adminMessageStore.ts`
- `server/src/services/applicantPortal.ts`
- `server/src/services/emailService.ts`
- `server/src/services/emailTemplates.ts`
- `server/src/services/mailboxStore.ts`
- `services/tierAccess.ts`
- `types.ts`

14. **Database implications.** No Prisma/database schema or migration change. Existing AdminMessage metadata carries mailbox state; existing Notification and private uploads are reused. Production requires its existing database/encryption/upload secrets, not new mail credentials. At larger scale, JSON recipient/thread query indexing and per-account storage quotas need a separately reviewed enhancement.

15. **Tests added/updated.** Added mailbox.integration.test.ts: role delivery/replies, canonical identity, peer denial, foreign read/reply/export/read-state denial, historical notices, lifecycle continuity/revocation, recipient privacy, field forgery, parameterized ownership queries, pagination, uploads, forged-file rejection, authorized/unauthorized downloads, public DTO/export sanitization, cleanup and lost-acknowledgement reconciliation. Extended canonicalIdentity.middleware.test.ts with ten mailbox-only allow/deny cases. Tests use an isolated in-memory database/upload adapter plus real HTTP routes and canonical middleware; they do not claim live PostgreSQL or production transport verification.

16. **Build/test results.**

| Check | Result |
| --- | --- |
| npm --prefix server run build | Passed |
| npm run build | Passed |
| Final npm --prefix server test -- --runInBand --silent | 201 passed / 202 total; 27 passed suites / 28 total |
| New mailbox tests and expanded middleware checks | Passed, including lost-acknowledgement reconciliation in final suite |
| npm run test:pwa | 3 passed / 3 total |
| Headless Edge local component check | Thread/reply UI visually inspected at 390 px mobile and 1440 px desktop; no control overflow; fixture API only |
| git diff --check | Passed |
| Supplemental frontend TypeScript check | Four errors in untouched files, detailed below; no reported mailbox error |

The sole backend failure is the pre-existing coreUserPersistenceLoop.integration.test.ts assertion at line 1227: expected PROFILE_SESSION_ESTABLISH_FAILED, received SESSION_ISSUE_FAILED. This mismatch was present before the correspondence work. Authentication code was not changed to mask it.

The broad root TypeScript invocation hit its default heap limit; a larger-heap retry was stopped, then a scoped frontend compilation completed. It reported existing errors in untouched EthicalAIInsight.tsx (externalSearchContext), JeruselaPortalView.tsx (setTimeout on never) and two backendApiService.ts ApiBody typing errors. The frontend production build succeeds, but the supplementary type check is not green.

17. **Known limits/issues.** No live PostgreSQL attachment round trip or production portal walkthrough has been performed. No SMTP delivery was tested or repaired. External recovery availability remains a separate operational dependency. Drafts are memory-only; there is no durable idempotency key, retry/outbox, antivirus/CDR, bulk ZIP export, delete/archive policy or distributed rate limiter. If a lifecycle update saves but mail cannot persist, the UI reports that distinction and asks for a manual mailbox resend. These limits and the 1,000-message thread cap are documented in the architecture guide. Existing backend/type-check failures remain outside the authorized correspondence scope.

18. **Exact manual production verification.** Follow the numbered rollout checklist in [INTERNAL_CORRESPONDENCE.md](INTERNAL_CORRESPONDENCE.md#exact-manual-rollout-verification): review/commit/deploy both packages, use consenting existing accounts without creating smoke users, check role delivery and foreign-URL denial, downloads/read state/lifecycle history, admin preview and mobile behavior. Do not use Jessica as a diagnostic recipient or approve an applicant solely to test mail. No credentials belong in chat, source control or the review artifacts.
