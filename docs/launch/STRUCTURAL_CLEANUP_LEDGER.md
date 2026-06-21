# Structural Cleanup Ledger

Provider Pilot Launch Readiness baseline: `e088212 fix: remove redundant internal provider page`.

## Active System Map

- Frontend shell and routing: `App.tsx`, `types.ts`, `constants.tsx`, `services/tierAccess.ts`
- Public/member surfaces: `Dashboard`, `KnowledgePathways`, `MyCourses`, `MembershipPage`, `CommunityMembers`, `SocialLearningHub`, `Profile`, `NotificationsCenter`
- Provider surfaces: `ProviderAccessPage`, `ProviderApplicationPage`, `ProviderApplicantSignInPage`, `ProviderApplicationStatusPage`, `ProviderCrmShell`
- Admin surfaces: `AdministrativeAccessPage`, `AdminDashboard`, `AdminProviderApplicantsPage`
- Meetings: `ConsciousMeetingsUpcomingPage`, `ConsciousMeetingPortalPage`, `ConsciousMeetingRoomPage`, `ConsciousMeetings`, `MeetingSimulationQA`
- AI: `EthicalAIInsight`, `server/src/routes/ai.ts`, `server/src/services/aiProviderService.ts`, `platformKnowledge.ts`, `aiSafetyPolicy.ts`
- Backend route mounts: `server/src/index.ts` mounts user, membership, courses, providers, provider applicants, provider auth/session/CRM, identity security, support, upload, reflection, social, admin, immersive, meeting, notifications, and conscious careers routes.
- Shared frontend services: `apiClient`, `backendApiService`, `sessionService`, `securityService`, `mediaAssets`, `mediaDeviceSupport`, `privateUploadService`, `tierAccess`, `walletProvider`
- Shared backend services: Prisma/local persistence, user/provider sessions, provider access, upload blob storage, social store, notifications, admin messages, email, audit telemetry, course metadata, AI services.

## Cleanup Performed

- Removed `components/MeetingsPage.tsx`.
  - Reason: unmounted legacy meeting surface with zero references outside itself.
  - Current meeting routes use `ConsciousMeetingsUpcomingPage`, `ConsciousMeetingPortalPage`, `ConsciousMeetingRoomPage`, and `ConsciousMeetings`.
- Removed unused static exports from `services/platformData.ts`:
  - `ProviderSurfaceRecord`
  - `MeetingSurfaceRecord`
  - `PROVIDER_SURFACE_RECORDS`
  - `COURSE_SURFACE_RECORDS`
  - `MEETING_SURFACE_RECORDS`
  - Reason: no runtime references remained after removing the unmounted legacy meeting surface. `MEMBERSHIP_TIERS` remains active and unchanged.

## Navigation And Route Consistency

- Preserved the custom `App.tsx` route resolver.
- Preserved all active `AppView` states because they are still referenced by route resolution, tier access, navigation, or route guards.
- No public, provider, admin, CRM, meeting, auth, Stripe, upload, or API contracts were changed.

## Preserved For Review

- `App.tsx` remains oversized and mixed-responsibility, but it is launch-critical and should not be reorganized in this pass.
- `ConsciousMeetings.tsx`, `ProviderCrmShell.tsx`, `AdminDashboard.tsx`, and `EthicalAIInsight.tsx` are large modules. They should be split later only with route-level regression coverage.
- Duplicate brand asset locations exist under `src/assets/brand` and `public/brand`; both are currently referenced and were preserved.
- Legacy Cloud Run scripts/docs remain in `server/scripts` and documentation. They are not active in the Render/Cloudflare production path but were preserved because deployment references can be operationally sensitive.

## Folder Organization Decision

No broad folder moves were performed. The active runtime still relies on root-level `App.tsx`, root `components/`, root `services/`, and `server/src/*`. Moving files into domain folders would require many import rewrites and is better handled in a separate reviewed refactor after provider pilot stabilization.
