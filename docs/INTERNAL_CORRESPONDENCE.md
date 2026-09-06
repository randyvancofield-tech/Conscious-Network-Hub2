# HCN internal correspondence

## Repository assessment and delivery map

The repository had three relevant facilities: AdminMessage for support, issue triage and applicant follow-ups; Notification for user-addressed lifecycle notices; and private PostgreSQL large-object uploads. These are reused. Meeting invitations, provider CRM operational records, social posts and AI conversations remain their own domain features, not unrestricted peer mail.

| Flow assessed | Existing path | Result |
| --- | --- | --- |
| Public support/contact and executive inquiries | App.tsx ? support.ts ? AdminMessage + optional SMTP | Administrative intake only. No mailbox identity inferred from submitted email. |
| Signed-in issue reporting | ai.ts ? AdminMessage + SMTP issue helper | Existing issue record becomes correspondence for canonical submitter and administration. AI triage/notes stay administrative. |
| Applicant submission | providerApplicants.ts ? application/user + Notification + applicant/admin emails | Existing account/application flow unchanged; internal acknowledgement and administrative intake replace emails. Notification links to correspondence. |
| Applicant follow-up | Applicant portal ? /current/follow-up ? encrypted AdminMessage | Shared Mailbox replaces separate form. Old endpoint remains compatible and historical replies appear in the same mailbox. |
| Review decisions/requests/approval | admin.ts ? lifecycle update + Notification + SMTP | Controls stay in admin. Internal correspondence and linked notification replace SMTP; text preserves both status and reviewer message. |
| Admin ? applicant/provider/member correspondence | Previously absent | Shared route/store/UI supports compose, reply, Inbox, Sent, History, read state, attachments and thread export. |
| Historical status notices | Notification, sometimes with skipped-email flags | Only the three applicant lifecycle notice types become correspondence, owned by original user ID regardless of later role. Other scopes unchanged. |
| Password recovery | user.ts ? emailService/emailTemplates, existing recovery-code path | External recovery retained unchanged: a pre-login user cannot read an internal inbox. |
| Other outbound helpers/configuration | Nodemailer, Gmail configuration, required-env validator, templates, deployment docs | No SMTP caller remains outside user.ts. Unused provider templates and issue sender removed. Gmail is optional recovery infrastructure. |
| Documents/downloads | Private blob store, owner/admin upload route, admin ZIP/export, privateUploadService | Reuse private blobs with message-specific download authorization. Existing document and ZIP workflows remain intact. |

Searches covered tracked code, environment examples, launch/deployment guides, tests, UI and services for sender helpers, SMTP/Gmail flags, inboxes, notifications, uploads, export and account/provider lifecycle. Sign-in, wallets, sessions, password validation, 2FA and recovery were not refactored.

## Data and identity

No Prisma schema or migration is required. AdminMessage already has body, subject, timestamps, canonical submitter ID and JSON metadata. New internal_mail records use versioned metadata: recipientUserId, threadId, attachment associations, per-account mailRead. Application correspondence uses a stable application thread identifier. Bodies reuse existing sensitive-text encryption. Subjects, identities, timestamps and attachment metadata are not end-to-end encrypted; this is an administratively managed mailbox.

Canonical user IDs route private mail. `administration` is a shared logical inbox for canonical admin-role accounts, not a new login/account. All canonical administrators can inspect administrative correspondence; this deliberate access is audited. Outgoing records retain the acting administrator's ID. Sender email fields remain compatibility/display data, never authorization.

Applicants retain the same user ID after approval. Their correspondence, historical notices and attachments remain available; provider tools still require existing approval/wallet checks. Inactive/rejected providers retain mailbox-only access. No duplicate identity or mailbox provisioning is needed.

Historical AdminMessage sources exposed to ordinary users are limited to applicant follow-up, issue reporting and application intake. Internal notes, resolution summaries, AI analysis, credential-bearing User objects, raw metadata and storage keys are excluded from mailbox DTOs. Anonymous records are administrative only. Existing admin triage retains contact details, notes, priority and resolution controls.

New lifecycle notifications include internalMessageId, avoiding duplicate mailbox presentation. Old notices remain visible without migration. Historical skipped-email flags remain untouched. Status/account changes precede correspondence in the existing workflow; authentication is not wrapped in a new transaction. Lifecycle persistence failure reports internalDelivered=false: the admin UI distinguishes saved status from failed mail and requests a manual mailbox resend. Application intake reports adminIntakeDelivered separately. Notifications remain a fallback.

## API and permissions

All /api/mail routes run existing canonical identity/session validation followed by participant checks. The sole authorization-middleware change is the user-approved method/path-specific mailbox allowlist for applicants and inactive providers. Unrelated authorization remains unchanged.

| Route | Purpose |
| --- | --- |
| GET /api/mail/recipients?search= | Users see administration only; admins search up to 50 identities with lifecycle status. |
| GET /api/mail/messages?cursor= | Authorized history, 50 records per timestamp/ID page. |
| GET /api/mail/messages/:id/thread | Authorized thread; each record independently scoped. |
| POST /api/mail/messages | JSON or multipart compose/reply; canonical sender and server-derived reply recipient. |
| PATCH /api/mail/messages/:id/read | Per-account read/unread; atomic JSON merge preserves other readers. |
| GET /api/mail/messages/:id/attachments/:attachmentId | Check participant, then resolve associated private object. |
| GET /api/mail/messages/:id/export | UTF-8 readable thread with sender, recipient, dates, references and attachment names. |

Foreign/unknown message and attachment IDs return 404. Audit events cover reads, sends, directory access, exports, downloads and denied/error outcomes without bodies, filenames, keys or credentials. Responses are no-store. Correspondence cannot approve applicants, change status, grant roles or run administrative commands.

## Attachments and export

Up to three files, 5 MB each: PDF, PNG, JPEG and UTF-8 text. Extension, MIME and signature/text encoding must agree. Filenames are sanitized. Files reuse private PostgreSQL storage with canonical ownership and correspondence category. Clients cannot submit storage keys or arbitrary URLs. Unsent objects receive best-effort cleanup after confirmed persistence failure. A lost write acknowledgement is reconciled by server-generated message ID before cleanup; if storage is unavailable and delivery remains uncertain, attachments are retained rather than deleting potentially delivered files.

Download checks the authorized message and attachment association before resolving storage. The generic upload route is not relaxed. Mail downloads force attachment disposition, binary content type, nosniff and a restrictive sandbox policy; no active inline rendering or HTML/SVG/Office format is enabled. Signature checks are not antivirus/CDR scanning and cannot guarantee that a PDF/image is harmless.

Thread text and attachments download separately. Threads above 1,000 messages return an explicit limit error rather than partial content. Mailbox history is paginated; bulk mailbox/ZIP export is deferred.

## Portal experience

- Administration: /admin ? Messages & Reports opens the shared Mailbox. Expand Intake triage and internal notes for ticket operations. Approval/rejection stays under applicant review.
- Applicants: /provider/application-status embeds the same Mailbox. Reply/compose and attachments do not require provider approval. Admin sample preview uses local sample data and disables send/download.
- Providers/members: HCN Mailbox appears in signed-in navigation at /mailbox, independent of membership tier, retaining the same identity/history.
- Inbox, Sent and History show the same records. Admin Sent includes shared administrative outgoing correspondence. Read state is individual, not recipient acknowledgement.
- Existing HCN panels/colors/Tailwind styling stack on mobile and use two columns on desktop. Drafts are memory-only; leaving the page discards them. There is no real-time chat or background external delivery.

## Operational limits

- No SMTP retries/import, polling, push notifications or unrestricted peer messaging.
- No new production users, decisions, live sends, schema/credential changes. Do not create smoke users for verification.
- Send limit: 20 requests per 15 minutes per IP, with bounded multipart memory. Shared-network users share the limit. No distributed limiter or per-account storage quota is introduced.
- A connection failure after successful persistence can leave delivery uncertain; check Sent before retrying. Durable idempotency/outbox and persistent drafts are future enhancements.
- Existing sender/chronology indexes are reused. Recipient/thread JSON lookups may need dedicated indexes at larger scale; no unapproved index migration was added.
- Retention follows existing database/backups. No delete/purge or mailbox archive is introduced; account deletion remains governed by existing administration behavior.

## Exact manual rollout verification

1. Review and commit the working tree yourself, then deploy backend/frontend together. No migration or new credentials. Preserve database/encryption/private-upload secrets. Gmail is not required for these checks; consider recovery availability before changing external flags.
2. Use your existing administrator and consenting existing applicant/provider/member accounts in separate browser profiles. Do not create smoke accounts or use Jessica as a test recipient.
3. In /admin ? Messages & Reports, search an applicant, confirm identity/status, send a labelled internal test with harmless text/PDF attachment. Confirm Sent survives refresh.
4. As that applicant, open /provider/application-status. Check Inbox/unread, sender/subject/time, open thread, download attachment/text export, mark unread and refresh. Reply with an attachment; confirm applicant Sent and admin Inbox/thread.
5. Repeat admin ? provider ? admin and admin ? member ? admin via /mailbox. Ordinary recipient selection must offer only administration.
6. With another consenting account's own session, request the first account's thread/export/read/attachment URLs. Expect 404/no content; unauthenticated requests expect 401. Reject HTML/SVG and renamed fake PDF. Confirm applicants still cannot reach CRM, checkout or unrelated admin APIs.
7. Inspect historical applicant follow-ups/notices. For a real separately authorized approval, compare references before/after; same user/history, existing wallet onboarding. Do not approve anyone solely to test mail. Lifecycle continuity is also covered locally.
8. In admin preview confirm sample-only content, no send/download/live mailbox requests. Check desktop/mobile, keyboard focus, long subjects/filenames, scrolling, file selection and downloads.
9. Review audit outcomes and persistence errors without secrets/content. internalDelivered=false means saved status still requires manual mail follow-up.
10. Inspect Jessica's history before deliberately sending anything missing. Skipped external mail is not automatically resent; internal success does not prove Gmail works.
11. Check existing login/admin/provider wallet entry. Test pre-login recovery separately only with an authorized account; never copy reset links, recovery codes or credentials to chat/logs.

See INTERNAL_CORRESPONDENCE_REVIEW.md for final local checks and the changed-file inventory.
