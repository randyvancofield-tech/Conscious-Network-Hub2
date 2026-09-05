# Applicant portal and administrative review

## Capability boundaries

| Space | Permitted work |
| --- | --- |
| Applicant portal | Sign in using application credentials; view own submitted information, requests and status; schedule discovery; send text follow-ups while review is open; read saved responses. |
| Admin workspace | Read application documents and follow-ups; keep internal notes; send applicant-facing requests; change review status; approve or reject through existing elevated admin controls. |
| Admin portal preview | Inspect sample application stages. No applicant messages, appointments, wallet binding, or decisions can be submitted from the preview. The administrator remains signed in. |
| Approved provider access | Sign in, bind a wallet the provider controls, and verify the bound wallet before provider tools open. |

The `/admin` dashboard offers separate review and read-only preview entries. The preview is not impersonation and does not display a real applicant's private information. Actual application review remains under `/admin/provider-applicants`.

## Review process

1. Review submitted information and record private assessments in Internal Admin Notes.
2. Set `under_review` or `discovery_scheduled` as appropriate. Do not use approval merely to let an applicant reply.
3. When requesting information, choose `needs_more_info` and write exactly what is needed, why it is needed, and a reasonable target date in Applicant Message. This message is visible in the portal even when email is not selected.
4. Read the applicant's reply in the admin inbox or application detail. A response does not approve the application or automatically change its stage.
5. Communicate the next step in the portal and record the status decision in admin review. Approval enables the existing provider wallet onboarding process; it does not bypass wallet verification.

Applicants should respond item by item, avoid repeated submissions, and check the saved-response confirmation before retrying. The current follow-up form accepts text, not attachments. Do not ask applicants to send identity documents, patient data, passwords, or recovery phrases through it. Additional-document upload is a separate future enhancement requiring file validation, private storage, ownership checks, and retention rules.

## Implementation and privacy

- New applicants use the applicant role. Legacy user accounts with pending applicant status receive the same server-side boundary.
- Public applicant responses use an explicit field allowlist; included User objects, internal notes, and consent audit records are excluded.
- Follow-up text is protected by the existing sensitive-data encryption service and stored in the existing AdminMessage inbox with the canonical user and application identifiers. No new database table is required.
- Applicant reads expose only their response text and timestamps. Internal inbox resolution and notes are never included.
- Follow-up writes accept only a message, cap it at 4,000 characters, and are rate limited. They cannot select another user, modify status, or grant access.
- Submitted responses appear in both administrative inbox and the application's review detail. The displayed history is limited to 250 responses per application.
- Production behavior changes only after backend and frontend deployment. No live application decisions or emails are made by implementing these changes.

## Wallet onboarding

The UI explains what a wallet controls, how to install or reuse one, how to safeguard its recovery method, and how CNH binding differs from later verification. CNH authentication uses a gasless signed message, not a payment or token-spending approval. Private keys and recovery phrases stay outside CNH. Wallet verification helps against password-only compromise but does not make every signature safe.

Official references checked September 5, 2026:

- https://ethereum.org/wallets/
- https://ethereum.org/developers/docs/ethereum-stack/authentication/
- https://support.metamask.io/start/user-guide-secret-recovery-phrase-password-and-private-keys
- https://support.metamask.io/stay-safe/safety-in-web3/basic-safety-and-security-tips-for-metamask

## Recommended next improvements

- An explicit review owner, target response date, and overdue queue.
- Private supplemental uploads with document version history and reviewer acknowledgement.
- Saved applicant drafts and idempotent response submission.
- A documented wallet-loss review process, without requesting wallet secrets.
- Accessibility and mobile wallet handoff checks with real approved-provider test sessions in an isolated environment.
