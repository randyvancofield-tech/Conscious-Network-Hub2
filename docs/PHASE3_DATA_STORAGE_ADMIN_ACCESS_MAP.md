# Phase 3 Data Storage And Admin Access Map

Generated for Phase 3 only: storage, persistence, route mapping, and admin/provider/applicant access.

## Storage Backend

- Canonical app data uses Prisma/PostgreSQL through `DATABASE_URL`.
- `server/src/services/persistenceStore.ts` is the active shared DB adapter. The older file-backed `localStore.ts` remains as a compatibility shape, but the exported `localStore` used by routes is DB-backed.
- Private and public uploads use PostgreSQL large objects through `server/src/services/uploadBlobStore.ts`. Upload object keys are signed and include access metadata.
- Audit events are written by `server/src/services/auditTelemetry.ts` to stdout and, unless disabled, `server/data/audit-events.log`. They are not Prisma records.

## Prisma Models And Raw Tables

| Data domain | Storage |
| --- | --- |
| Users, profiles, privacy settings, password/reset fields, profile media refs, provider approval state | `User` |
| Provider applications and review state | `ProviderApplicant` |
| Provider applicant documents | PostgreSQL large objects; private object refs stored in `ProviderApplicant.resumeFile` and `ProviderApplicant.coverLetterFile` |
| Conscious Careers grant applications | `ConsciousCareerGrantApplication` |
| Courses | `Course` |
| Course enrollments/progress | `UserCourse` |
| Provider anchor/link requests | `AnchorLinkRequest` |
| Meetings, participants, invites, links, room signals | `MeetingSession` JSON fields plus columns |
| Reflections | `Reflection` plus private uploaded object refs |
| Membership state | `Membership` plus denormalized membership fields on `User` |
| Payment history / Stripe idempotency markers | `PaymentHistory` |
| Provider/admin wallet challenges | `ProviderChallenge` |
| Provider sessions and canonical user sessions | `ProviderSession` |
| Provider invite groups | `ProviderInviteGroup` |
| Social posts/media/likes/follows | `SocialPost`, `SocialPostMedia`, `SocialPostLike`, `SocialFollow` |
| Provider CRM records, notes, collaborations, follow-ups | Raw table `ProviderCrmRecord` created by `providerCrmWorkspaceStore.ts` |
| Provider CRM roundtable reservations | Raw table `ProviderRoundtableReservation` plus linked `MeetingSession` |
| Provider CRM tool visibility | Raw table `ProviderCrmToolVisibility` |
| AI interactions | `AiInteraction` model exists, but current AI routes do not write to it |
| Contact submissions | No DB table; current route sends email and emits audit event only |
| Notifications | `Notification` |

## Route-To-Storage Map

| Flow | Frontend entry | Backend route | Storage / confirmation |
| --- | --- | --- | --- |
| Member signup | `App.tsx` | `POST /api/user/create` | Creates `User`, persisted canonical session in `ProviderSession` with `user:{id}` DID, returns token and public user |
| Sign in | `App.tsx`, applicant/provider sign-in pages | `POST /api/user/signin` | Reads `User`, creates persisted canonical session in `ProviderSession`, returns token and public user |
| Profile update | `Profile.tsx`, `CommunityLayout.tsx`, `App.tsx` | `PUT /api/user/:id`, `POST /api/social/profile` | Updates authenticated user's `User` row only after canonical user match |
| Profile/avatar/banner/background upload | `Profile.tsx`, `CommunityLayout.tsx` | `POST /api/upload/avatar`, `/cover`, `/profile-background` | Stores public upload large object and writes returned URL/object key to `User` on profile save |
| Provider application | `ProviderApplicationPage.tsx` via `App.tsx` | `POST /api/provider-applicants/apply` | Creates applicant `User`, stores private resume/cover letter large objects, creates `ProviderApplicant`, sends lifecycle emails when configured, creates notification, returns token, applicant, calendly URL |
| Applicant status | `ProviderApplicationStatusPage.tsx` | `GET /api/provider-applicants/current`, `POST /current/calendly-shown` | Reads/updates applicant's own `ProviderApplicant` record |
| Admin provider review | `AdminProviderApplicantsPage.tsx` | `GET/PATCH /api/admin/provider-applicants` | Lists, views, and updates `ProviderApplicant`; approval updates `User` provider state; status changes can send applicant lifecycle email and notification; non-approved review states revoke active provider access when needed |
| Membership checkout | `MembershipPage.tsx` via `App.tsx` | `POST /api/membership/stripe/create-checkout-session`, `/confirm-session`, Stripe webhook | Upserts `Membership`, creates `PaymentHistory`, updates `User` membership/subscription fields, creates user-scoped notifications for membership/payment state changes |
| Membership status | `App.tsx` | `GET /api/membership/status/:userId` | Reads requesting user's `User`, `Membership`, and `PaymentHistory` |
| Course catalog | `KnowledgePathways.tsx` | `GET /api/courses` | Ensures defaults in `Course`, returns published courses |
| Course enrollment | `App.tsx` | `POST /api/courses/:id/enroll` | Upserts `UserCourse` for authenticated user |
| My courses/progress | `App.tsx`, `MyCourses.tsx` | `GET /api/user/courses`, `PATCH /api/user/courses/:id/progress` | Reads/updates authenticated user's `UserCourse` rows |
| Reflections | `Profile.tsx` | `POST /api/upload/reflection`, then `POST/GET/PATCH/DELETE /api/reflection` | Stores private upload object and `Reflection` row; owner-only read/update/delete. The community text reflection composer is not wired to this route. |
| Social posts | `SocialLearningHub.tsx` | `POST/GET/PATCH/DELETE /api/social/posts`, `/newsfeed`, `/profile/:userId`, `/like`, `/follow` | Stores `SocialPost`, `SocialPostMedia`, `SocialPostLike`, `SocialFollow`; privacy filtering is applied on profile/newsfeed reads |
| Social comments/linkages | `SocialLearningHub.tsx` | None | Not persisted; UI marks comments as being prepared |
| Member messaging | `CommunityMembers.tsx` | None | Not persisted; local UI state only |
| Provider directory request | `ProvidersMarket.tsx` | `POST /api/providers/:id/request` | Creates `AnchorLinkRequest`; user/provider request lists read only their side |
| Provider request queue | Provider routes | `GET/PATCH /api/provider/requests` | Provider must have active provider access; reads/updates owned `AnchorLinkRequest` |
| Provider wallet challenge/session | `ProviderAccessPage.tsx`, `IdentitySecurityPanel.tsx`, `App.tsx` | `/api/provider/auth/wallet/nonce`, `/verify`, `/session` | Stores challenge in `ProviderChallenge`, consumes it, creates `ProviderSession`; approved provider/admin access required |
| Admin wallet challenge/session | `App.tsx` | `/api/provider/auth/admin/wallet/*` | Stores admin wallet challenge in `ProviderChallenge`, creates admin canonical/provider sessions |
| Identity wallet session | `IdentitySecurityPanel.tsx` | `/api/identity-security/challenge`, `/verify`, `/session`, `/logout` | Challenge is in-memory only; verified `walletDid` persists on `User`; session is signed JWT/cookie |
| Provider CRM workspace | `ProviderCrmShell.tsx` | `/api/provider/crm/*` | Uses `ProviderCrmRecord`, `Course`, `ProviderRoundtableReservation`, `MeetingSession`, `ProviderCrmToolVisibility`; scoped by provider session |
| Meetings | `ConsciousMeetings.tsx`, meeting pages | `/api/meeting/provider/*`, `/user/*`, `/guest/*` | Stores sessions, invited members, participants, external links, and signals in `MeetingSession` |
| Conscious Careers grant application | `GrantApplicationPage.tsx` via `App.tsx` | `POST /api/conscious-careers/grant-applications` | Creates `ConsciousCareerGrantApplication`; no admin review/list route currently present |
| Contact/support form | `App.tsx` | `POST /api/support/contact` | Sends through `emailService`, emits audit event, returns ticket ID; no DB row currently |
| AI chat/wisdom/report issue/trending | `EthicalAIInsight.tsx`, `backendApiService.ts` | `/api/ai/*` | Generates responses; current routes do not persist `AiInteraction`. Issue reports may send email and return confirmation |
| Notifications center | `NotificationsCenter.tsx` | `GET/PATCH /api/notifications` | Reads and marks authenticated user's `Notification` rows only; role scope is enforced server-side |

## Admin Access Map

| Admin surface | Route/UI | Gate | Data visible/actions |
| --- | --- | --- | --- |
| Admin elevation | `POST /api/admin/elevate` | Canonical user session + `role === admin` + password or configured elevation code | Issues short-lived admin elevation token |
| Admin dashboard | `AdminDashboard.tsx`, `GET /api/admin/dashboard` | Admin role + elevation token | User role counts, membership summary, provider approval count, recent users |
| Admin users | `GET /api/admin/users` | Admin role + elevation token | User summaries only |
| Admin role change | `PATCH /api/admin/users/:id/role` | Admin role + elevation token | Updates `User.role`; self-role change denied and audited |
| Provider applicant queue | `AdminProviderApplicantsPage.tsx`, `GET /api/admin/provider-applicants` | Admin role + elevation token | Lists decrypted provider applicant records and private document refs |
| Provider applicant detail | `GET /api/admin/provider-applicants/:id` | Admin role + elevation token | Applicant detail, credentials, answers, document refs |
| Provider applicant review | `PATCH /api/admin/provider-applicants/:id` | Admin role + elevation token | Updates status/admin notes; can send applicant lifecycle email and notification; approving grants provider state; moving from approved to another review state revokes active provider access |
| Private applicant documents | `openPrivateUpload`, `GET /api/upload/object/:objectKey` | Canonical user token; owner or admin can read private objects | Admin can open private applicant docs when object key is present from admin applicant route |
| Provider CRM admin tools | `ProviderCrmShell.tsx`, `/api/provider/crm/admin/*` | Provider session token for an admin user, active provider/admin access, configured sole admin email | Provider CRM foundation/tools/oversight and cross-provider aggregate CRM analytics |

## Missing Or Limited Persistence Findings

- Contact submissions are not stored in a database table. They produce an email delivery attempt and audit event only.
- Notifications are not persisted; no notification model or route is present.
- AI interactions are not persisted even though `AiInteraction` exists in Prisma.
- Social comments/linkages and member messaging are not persisted.
- Conscious Careers grant applications persist to `ConsciousCareerGrantApplication`, but there is no admin list/review route in the current code.
- Immersive lifecycle telemetry is held in memory for rate/session state and audit logs only.

## Phase 4 Email Trigger Attachment Points

- Provider application submitted: after `createProviderApplicant` succeeds in `providerApplicants.ts`.
- Provider application status changes: after `PATCH /api/admin/provider-applicants/:id` updates status.
- Conscious Careers grant application submitted: after `createConsciousCareerGrantApplication` succeeds.
- Membership activation/cancel/past-due: after Stripe checkout confirmation and webhook membership sync.
- Provider request created/updated: after `AnchorLinkRequest` create/update in `providers.ts`.
- Meeting invites/external links: after provider meeting invite/link creation in `meeting.ts`.
- Support/contact: `support.ts` already calls `emailService`; Phase 4 should decide whether to also persist submissions.
