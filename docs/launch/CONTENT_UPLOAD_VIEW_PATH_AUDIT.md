# Content Upload And Viewing Path Audit

Audit date: 2026-06-03

Scope: static codebase analysis of upload, content persistence, and content viewing paths across the React/Vite frontend and Express/Prisma backend. This report does not change runtime behavior or database state.

## Executive Summary

The platform has four distinct content pipelines:

1. Object-backed binary media: profile/avatar/cover/background, social media, reflections, and provider applicant documents use `uploadBlobStore` encrypted object keys and Render/backend-hosted object routes.
2. Record-backed text/content: social posts, reflections, courses, provider CRM notes/content, admin inbox messages, grant applications, and meetings store content in Prisma/local store records.
3. Static/build assets: logos, meeting brand media, course placeholder images, and homepage video are served from `public/` or imported `src/assets`.
4. Browser-memory media: meeting custom backgrounds and local meeting recordings use `URL.createObjectURL` and are intentionally not persisted.

The strongest alignment is around the upload object contract:

- Public media should render from `/uploads/object/:objectKey`.
- Private media should open through authenticated `/api/upload/object/:objectKey`.
- Frontend-hosted upload URLs from `conscious-network.org/uploads/object/...` should be rewritten to the backend origin.

The main alignment risks are duplicated profile upload components, multiple URL normalization helpers, two-step social media upload/post creation, and several content systems that store records but do not share a single media abstraction.

## Backend Route Mounts

| Mount | File | Lines | Purpose |
| --- | --- | ---: | --- |
| `/api/upload` | `server/src/index.ts` | 313 | Protected upload and private object retrieval route. |
| `/uploads` | `server/src/index.ts` | 324 | Public upload object retrieval route. |
| `/api/reflection` | `server/src/index.ts` | 314 | Private reflection CRUD. |
| `/api/social` | `server/src/index.ts` | 315 | Social profiles, posts, media records, likes, follows, feed. |
| `/api/provider-applicants` public | `server/src/index.ts` | 298 | Provider application submission with private documents. |
| `/api/provider-applicants` protected | `server/src/index.ts` | 319 | Applicant status and applicant portal updates. |
| `/api/courses` public/protected | `server/src/index.ts` | 296, 310 | Published course viewing and protected enrollment. |
| `/api/user` protected | `server/src/index.ts` | 306-307 | Profile updates and user course progress. |
| `/api/admin` | `server/src/index.ts` | 312 | Admin viewing/moderation for users, courses, social posts, applicants, inbox. |
| `/api/provider/crm` | `server/src/index.ts` | 317 | Provider CRM records, notes, content, collaboration, follow-ups. |
| `/api/conscious-careers` | `server/src/index.ts` | 320 | Conscious Careers grant application submission. |
| `/api/meeting` | `server/src/index.ts` | 322 | Provider/user/guest meeting sessions and signals. |
| `/api/support` | `server/src/index.ts` | 302 | Public contact submission to admin inbox. |
| `/api/ai` | `server/src/index.ts` | 311 | AI chat, wisdom, issue reports, admin reindex/status. |

## Object Storage And URL Construction

| Path | File | Lines | Notes |
| --- | --- | ---: | --- |
| Upload key secret resolution | `server/src/services/uploadBlobStore.ts` | 77 | Uses required secret material to protect upload object keys. |
| Encrypted object key encoding | `server/src/services/uploadBlobStore.ts` | 138 | Encodes storage metadata, access, owner, category, MIME type. |
| Encrypted object key decoding | `server/src/services/uploadBlobStore.ts` | 166, 227 | Decodes current encrypted object keys and PostgreSQL upload keys. |
| Object access metadata | `server/src/services/uploadBlobStore.ts` | 286 | Reads access/category/owner metadata from object key. |
| Public readability check | `server/src/services/uploadBlobStore.ts` | 302 | Determines if `/uploads/object/:key` may serve the object. |
| Persist upload object | `server/src/services/uploadBlobStore.ts` | 313, 355 | Writes binary upload to PostgreSQL large object storage. |
| Resolve upload object | `server/src/services/uploadBlobStore.ts` | 369 | Reads binary object and MIME type for response. |
| Delete upload object | `server/src/services/uploadBlobStore.ts` | 402 | Used by reflection delete/admin social delete cleanup. |
| Backend public base URL | `server/src/services/publicUrl.ts` | 40 | Determines absolute backend URL for media. |
| Backend URL absolutizer | `server/src/services/publicUrl.ts` | 57 | Rewrites frontend-hosted upload URLs to backend origin. |
| Extract object key from URL | `server/src/services/publicUrl.ts` | 82 | Supports `/uploads/object/:key` and `/api/upload/object/:key`. |
| Build backend upload URL | `server/src/services/publicUrl.ts` | 98 | Builds absolute public/private upload object URL. |
| Frontend backend base URL | `services/apiClient.ts` | 21, 229 | Uses `VITE_BACKEND_URL` unless local dev intentionally ignores it. |
| Frontend upload-key detection | `services/apiClient.ts` | 24, 41 | Detects object routes and opaque/encrypted object keys. |
| Frontend public upload URL | `services/apiClient.ts` | 58 | Maps raw public object key to `/uploads/object/:key` on backend. |
| Frontend stale-host rewrite | `services/apiClient.ts` | 63, 216-223 | Rewrites `conscious-network.org/uploads/object/...` to backend. |
| Private upload opener | `services/privateUploadService.ts` | 21, 28, 43, 54 | Fetches private object with bearer token, creates Blob URL, opens file. |

## Binary Upload Endpoints

| Endpoint | File | Lines | Access | Category | Returned URL shape |
| --- | --- | ---: | --- | --- | --- |
| `POST /api/upload/profile-background` | `server/src/routes/upload.ts` | 289-299 | Protected | `profile-background` | Public object URL from `persisted.publicPath`. |
| `POST /api/upload/avatar` | `server/src/routes/upload.ts` | 303-308 | Protected | `avatar` | Public object URL. |
| `POST /api/upload/cover` | `server/src/routes/upload.ts` | 312-317 | Protected | `cover` | Public object URL. |
| `POST /api/upload/reflection` | `server/src/routes/upload.ts` | 321-327 | Protected | `reflection` | Private `/api/upload/object/:key` URL. |
| `POST /api/upload/social` | `server/src/routes/upload.ts` | 331-345 | Protected | `social` | Public `/uploads/object/:key` URL. |
| Public object GET | `server/src/routes/upload.ts` | 251-263 | Public, metadata-gated | public categories only | Serves object bytes. |
| Private object GET | `server/src/routes/upload.ts` | 267-280 | Protected, owner/admin/provider-applicant aware | private categories | Serves object bytes. |
| Response builder | `server/src/routes/upload.ts` | 62-95, 136 | Shared | all upload categories | Returns `fileUrl` and `media` metadata. |
| Object response headers | `server/src/routes/upload.ts` | 151-180 | Shared | public/private | Sets `Content-Type`, cache, CORP, range support. |

Category and access alignment:

- `server/src/routes/upload.ts:59-80` maps `reflection` to private and all other generic upload categories to public.
- `server/src/routes/upload.ts:232-280` permits private upload reads for owner/admin/provider-applicant document access.

## Profile Media Upload And Viewing

### Active profile path

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| `/profile` route maps to identity view | `App.tsx` | 250, 324, 3715 | Active route uses `ConsciousIdentity` from `CommunityLayout`. |
| Active component import | `App.tsx` | 25 | Imports `ConsciousIdentity` from `components/community/CommunityLayout`. |
| Normalize media URL | `components/community/CommunityLayout.tsx` | 60-61 | Uses `backendAssetUrl`. |
| Initial avatar/banner state | `components/community/CommunityLayout.tsx` | 207-220 | Builds `profileMedia.avatar` and `profileMedia.cover`. |
| Upload handler | `components/community/CommunityLayout.tsx` | 278-332 | Chooses `/upload/avatar` or `/upload/cover`, persists returned `fileUrl` and metadata. |
| File inputs | `components/community/CommunityLayout.tsx` | 483, 500 | Accept image/video/GIF formats for avatar/cover. |
| Profile media frame | `components/community/CommunityLayout.tsx` | 95-141 | Renders video or image with backend URL normalization. |
| Preview/render frames | `components/community/CommunityLayout.tsx` | 470-490, 711-739 | Displays banner and avatar in edit and profile preview areas. |
| Save user profile | `components/community/CommunityLayout.tsx` | 896-903 | Sends `avatarUrl`, `bannerUrl`, and `profileMedia` to parent save handler. |
| Parent profile save | `App.tsx` | 2547-2574 | Calls `PUT /api/user/:id` with profile media fields and canonicalizes result. |
| Server user serializer | `server/src/routes/user.ts` | 436-451 | Absolutizes avatar/banner/profile media/background video. |
| Server user update | `server/src/routes/user.ts` | 1863-1938 | Protected `PUT /api/user/:id` profile update. |
| Prisma persistence | `server/src/services/persistenceStore.ts` | 460-551 | Updates `avatarUrl`, `bannerUrl`, `profileMedia`, `profileBackgroundVideo`. |
| Local fallback persistence | `server/src/services/localStore.ts` | 1033-1122 | Same fields in local store. |

### Legacy/stale duplicate profile path

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Duplicate `Profile` component | `components/Profile.tsx` | 31 | Full upload/reflection component exists. |
| Duplicate URL normalizer | `components/Profile.tsx` | 35 | Uses `backendAssetUrl`, similar to active profile. |
| Background/avatar/cover uploads | `components/Profile.tsx` | 136, 147, 167 | Calls `/upload/profile-background`, `/upload/avatar`, `/upload/cover`. |
| Reflection upload/CRUD | `components/Profile.tsx` | 83, 209-253 | Calls `/reflection` endpoints. |
| Private reflection open | `components/Profile.tsx` | 384, 395 | Uses `openPrivateUpload`. |
| Import search result | `components/Profile.tsx` | 31 only | No active import/use found in `App.tsx`; this appears orphaned. |

Alignment note: `components/Profile.tsx` is not mounted in the active app path, but it is a full duplicate upload/view implementation. If revived accidentally, it can drift from `CommunityLayout` behavior.

## Reflection Upload And Viewing

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Upload private reflection file | `components/community/CommunityLayout.tsx` | 363-387 | Uploads `/upload/reflection`, then creates `/reflection` record. |
| Load reflections | `components/community/CommunityLayout.tsx` | 344-353 | Calls `GET /api/reflection/:userId`. |
| Update reflection | `components/community/CommunityLayout.tsx` | 402-421 | Calls `PATCH /api/reflection/:reflectionId`. |
| Delete reflection | `components/community/CommunityLayout.tsx` | 427-433 | Calls `DELETE /api/reflection/:reflectionId`. |
| Open private reflection | `components/community/CommunityLayout.tsx` | 1017-1021 | Uses `openPrivateUpload`, not direct `<img>`/`<video>` tag. |
| Create reflection | `server/src/routes/reflection.ts` | 71-100 | Requires authenticated user match and private owner-owned upload. |
| List reflections | `server/src/routes/reflection.ts` | 111-123 | Owner-only list with absolutized `fileUrl`. |
| Update reflection | `server/src/routes/reflection.ts` | 134-169 | Owner-only content update. |
| Delete reflection | `server/src/routes/reflection.ts` | 182-212 | Owner-only delete and blob cleanup. |
| Validate private upload attach | `server/src/routes/reflection.ts` | 55-63, 87-89 | Requires private object, same owner, `reflection` category. |
| Extract object key | `server/src/routes/reflection.ts` | 30-37 | Supports both upload object route shapes. |
| Schema | `server/prisma/schema.prisma` | 359-363 | `Reflection.fileUrl` stores upload URL. |
| Tests | `server/src/__tests__/reflectionRoutes.lifecycle.test.ts` | 182-287 | Covers owner CRUD, cross-user blocking, public/other-user upload rejection. |

Alignment note: reflection file display correctly avoids direct image/video embedding because private object retrieval needs a bearer token. Any future inline preview must use authenticated fetch-to-blob rather than raw `<img src>`.

## Social Posts, Social Media, And Member Profile Viewing

### Frontend social post upload and render

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Social view route | `App.tsx` | 228, 312, 3653 | `/social` and `/social-learning` mount `SocialLearningHub`. |
| Feed load | `components/SocialLearningHub.tsx` | 228-249 | Calls `/social/newsfeed?limit=100`. |
| Deep link load | `components/SocialLearningHub.tsx` | 253-294 | Loads `/social/posts/:id` from `?node=...`. |
| File selection | `components/SocialLearningHub.tsx` | 316-344 | Selects image/video/file and local preview data URL. |
| Upload social media | `components/SocialLearningHub.tsx` | 365-380 | Calls `/upload/social` and normalizes returned file URL. |
| Create post | `components/SocialLearningHub.tsx` | 352-409 | Calls `/social/posts` with media metadata. |
| Like/edit/delete | `components/SocialLearningHub.tsx` | 428, 528, 548 | Calls social post mutation endpoints. |
| Social media render | `components/SocialLearningHub.tsx` | 109-162, 970-973 | Renders image/video through `SocialMediaFrame`. |
| Author/avatar render | `components/SocialLearningHub.tsx` | 93-106, 169-178, 944-948 | Uses `normalizeMediaAsset` for avatar. |
| Social profile modal | `components/SocialLearningHub.tsx` | 455-471, 657 | Calls `/social/profile/:authorId` and renders `SocialProfileViewer`. |

### Backend social routes and store

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Canonical upload URL helper | `server/src/routes/social.ts` | 52-76 | Converts object keys or upload URLs into backend-hosted public URLs. |
| Enrich post media response | `server/src/routes/social.ts` | 79-83 | Rewrites media URL before returning post. |
| Normalize post media input | `server/src/routes/social.ts` | 90-112 | Sanitizes media array from frontend. |
| Validate media access | `server/src/routes/social.ts` | 112-142 | Checks whether media entries are allowed for visibility. |
| Enrich post response | `server/src/routes/social.ts` | 142-146 | Adds media and author avatar URLs. |
| Public profile response | `server/src/routes/social.ts` | 166-221 | Absolutizes profile media for viewer. |
| Get profile | `server/src/routes/social.ts` | 238-304 | Profile plus posts for viewer. |
| Update profile | `server/src/routes/social.ts` | 320-375 | Social profile patch. |
| Create post | `server/src/routes/social.ts` | 383-441 | Persists normalized media to `SocialPostMedia`. |
| Get post | `server/src/routes/social.ts` | 481-515 | Deep link post retrieval. |
| Like post | `server/src/routes/social.ts` | 523 | Like toggle/access. |
| Edit post | `server/src/routes/social.ts` | 638-693 | Author mutation. |
| Delete post | `server/src/routes/social.ts` | 706 | Author deletion. |
| Newsfeed | `server/src/routes/social.ts` | 888-943 | Returns posts with enriched media. |
| Store media type normalization | `server/src/services/socialStore.ts` | 52-68 | Normalizes `image`, `video`, `file`. |
| Store Prisma mapping | `server/src/services/socialStore.ts` | 78-90 | Maps `SocialPostMedia.objectKey`, `url`, `storageProvider`. |
| Create post store | `server/src/services/socialStore.ts` | 98-139 | Creates media rows in transaction with post. |
| Read/update/delete/list store | `server/src/services/socialStore.ts` | 145-291 | Post CRUD and feed queries include media. |
| Schema | `server/prisma/schema.prisma` | 450-472 | `SocialPost` and `SocialPostMedia.objectKey`. |
| Social migrations | `server/prisma/migrations/20260219121000_add_social_models/migration.sql` | 1-59 | Creates social tables and indexes. |

### Member directory and profile viewing

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Community members route | `App.tsx` | 3664 | Renders `CommunityMembers`. |
| Directory media normalization | `components/CommunityMembers.tsx` | 138-153 | Uses `backendAssetUrl` and `getProfileAvatarMedia`. |
| Directory profile fetch | `components/CommunityMembers.tsx` | 190-209 | Calls `/social/profile/:memberId`. |
| Directory avatar render | `components/CommunityMembers.tsx` | 74-90, 330, 408, 499 | Renders image/video avatar. |
| Profile viewer media normalization | `components/SocialProfileViewer.tsx` | 170-172, 350 | Uses `mediaAssets` helpers. |
| Profile viewer media render | `components/SocialProfileViewer.tsx` | 68-84, 123-133, 356-368 | Renders avatar/banner/post media. |
| Provider market profile media | `components/ProvidersMarket.tsx` | 47-63, 78-89, 414 | Uses normalized provider avatar/hero media. |

Alignment note: social media uses a two-step flow: `/api/upload/social` first, then `/api/social/posts`. If post creation fails after upload succeeds, an orphaned public object can remain because the upload object is not transactionally tied to the post.

## Provider Applicant Documents

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Provider application form data | `components/ProviderApplicationPage.tsx` | 278-285 | Appends `resume` and `coverLetter`. |
| Submit application | `components/ProviderApplicationPage.tsx` | 289-301, 639 | Calls parent `onSubmit`. |
| Parent submit handler | `App.tsx` | 1763-1764, 3603 | Calls `POST /api/provider-applicants/apply`. |
| Multer document handling | `server/src/routes/providerApplicants.ts` | 50-56, 281 | Accepts two document files. |
| Document validation | `server/src/routes/providerApplicants.ts` | 246-250 | Allows PDF/DOC/DOCX/RTF/TXT. |
| Persist applicant document | `server/src/routes/providerApplicants.ts` | 258-273 | Persists private upload object and returns file ref. |
| Application create | `server/src/routes/providerApplicants.ts` | 296-409, 435-436 | Persists resume and cover letter refs. |
| Applicant current view | `server/src/routes/providerApplicants.ts` | 566, 596-606 | Protected applicant status/read/update routes. |
| Applicant store reveal/protect | `server/src/services/providerApplicantStore.ts` | 135-143, 180-181 | Protects/reveals applicant file JSON. |
| Applicant status page file open | `components/ProviderApplicationStatusPage.tsx` | 69-78, 357-358 | Opens private files through `openPrivateUpload`. |
| Admin applicant list/detail/update | `server/src/routes/admin.ts` | 1402, 1427, 1449 | Admin review routes. |
| Admin applicant file open | `components/AdminProviderApplicantsPage.tsx` | 4, 416-425 | Opens private file refs with `openPrivateUpload`. |
| Schema | `server/prisma/schema.prisma` | 120, 147-148 | `ProviderApplicant.resumeFile` and `coverLetterFile` JSON. |
| Migration | `server/prisma/migrations/20260511031000_provider_applicants/migration.sql` | 3-60 | Creates provider applicant table. |

Alignment note: applicant files are private object uploads but do not enter through `/api/upload/reflection`; they enter through `/api/provider-applicants/apply`. They still rely on the shared `uploadBlobStore` key semantics and private object retrieval route.

## Course Content Viewing, Enrollment, And Progress

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Course list/detail route mapping | `App.tsx` | 243-245, 322 | `/courses` and `/courses/:id`. |
| Course API load | `components/KnowledgePathways.tsx` | 91-111 | Calls `/courses` or `/courses/:id`. |
| Course detail image render | `components/KnowledgePathways.tsx` | 192 | Renders `routeCourse.image`. |
| Course cards image render | `components/KnowledgePathways.tsx` | 300-301 | Renders course card image. |
| Syllabus modal image render | `components/KnowledgePathways.tsx` | 379 | Renders selected course image. |
| Public course list | `server/src/routes/courses.ts` | 110-120 | Filters `status: 'published'`. |
| Public course detail | `server/src/routes/courses.ts` | 126-145 | Filters by id and `status: 'published'`. |
| Protected enrollment | `server/src/routes/courses.ts` | 151-188 | Requires membership and published course. |
| My courses load | `App.tsx` | 897 | Calls `/user/courses`. |
| My courses render | `components/MyCourses.tsx` | 86-90, 159 | Renders enrolled course images. |
| My courses modal/progress | `components/MyCourses.tsx` | 33-47, 199-219 | Updates progress via prop handler. |
| User course list | `server/src/routes/userCourses.ts` | 82-99 | Owner-only published-course enrollments. |
| User course progress | `server/src/routes/userCourses.ts` | 103-145 | Owner-only progress update. |
| Admin course governance | `server/src/routes/admin.ts` | 827, 847, 926, 1002, 1065 | Admin list/owner/enrollment assign/update/delete. |
| Admin course UI | `components/AdminDashboard.tsx` | 476-526, 914-1057 | View enrolled users/providers, assign/reassign. |
| Schema | `server/prisma/schema.prisma` | 242-249, 265 | `Course.image`, `UserCourse`. |

Alignment note: course `image` is a string field and is not routed through the upload object system. Public course viewing is backend-filtered to published records, which is aligned with launch requirements.

## Provider CRM Content And Notes

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Provider CRM routes | `server/src/routes/providerCrm.ts` | 171-604 | Provider-scoped tools, workspace, notes, content, collaboration, follow-ups, analytics. |
| CRM workspace read | `server/src/routes/providerCrm.ts` | 218-229 | Provider-scoped workspace view. |
| CRM notes CRUD | `server/src/routes/providerCrm.ts` | 278-323 | Notes are provider-scoped and gated by `notes` tool. |
| CRM content CRUD | `server/src/routes/providerCrm.ts` | 327-356 | Course/content item list/create/update gated by `content-courses`. |
| CRM collaboration CRUD | `server/src/routes/providerCrm.ts` | 364-409 | Provider collaboration records. |
| CRM follow-up CRUD | `server/src/routes/providerCrm.ts` | 413-458 | Provider follow-ups. |
| CRM service records | `server/src/services/providerCrmWorkspaceStore.ts` | 543-570 | Generic CRM record list/create. |
| CRM notes service | `server/src/services/providerCrmWorkspaceStore.ts` | 822-887 | Notes list/create/update/delete. |
| CRM content service | `server/src/services/providerCrmWorkspaceStore.ts` | 1070-1111 | Content list/create/update. |
| CRM frontend service wrapper | `services/backendApiService.ts` | 857-986, 1881-1920 | Calls CRM notes/content endpoints. |
| CRM frontend UI | `components/ProviderCrmShell.tsx` | 546-579, 842-981 | Notes and content forms/lists. |

Alignment note: provider CRM content is text/metadata content, not binary upload. It does not use the object storage pipeline.

## Meeting Content, Media, And Signals

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Provider session routes | `server/src/routes/meeting.ts` | 767, 808, 834, 913 | Start/end/invite/external links. |
| User session viewing | `server/src/routes/meeting.ts` | 1002, 1046, 1094 | Joinable/archive/room-config. |
| Meeting signals | `server/src/routes/meeting.ts` | 1121, 1161-1211 | In-memory/metadata signal messages capped by `MAX_SIGNAL_MESSAGES`. |
| Guest meeting routes | `server/src/routes/meeting.ts` | 1291, 1336, 1409, 1445 | Preview/join/leave guest flow. |
| Meeting frontend service | `services/backendApiService.ts` | 1229-1563, 2025-2146 | Provider/user/guest meeting API wrapper functions. |
| Meeting session UI calls | `components/ConsciousMeetings.tsx` | 527-541, 597, 698, 728, 759, 793, 820, 839, 862, 889 | Calls provider/user/guest meeting APIs. |
| Meeting room calls | `components/ConsciousMeetingRoomPage.tsx` | 79, 119, 159, 169 | Loads session, joins/leaves, posts signals. |
| Upcoming meetings | `components/ConsciousMeetingsUpcomingPage.tsx` | 20, 89 | Lists upcoming sessions. |
| Custom background upload | `components/ConsciousMeetings.tsx` | 1681-1703, 2816-2817 | Browser-only object URL, max 25 MB, image/video types. |
| Background render/compositing | `components/ConsciousMeetings.tsx` | 2113-2165 | Loads image/video in browser and draws to canvas. |
| Local recording | `components/ConsciousMeetings.tsx` | 1560-1650, 2684, 2735 | Browser-only MediaRecorder and download. |
| Static meeting brand media | `components/ui/MeetingBrandLoop.tsx` | 10-11, 61-72 | Serves `/brand/conscious-meetings-loop.jpg` and CNH logo. |
| Meeting brand usage | `components/ConsciousMeetings.tsx` | 2435-2443, 2916-2924, 3418-3425 | Meeting pages display static brand loop. |

Alignment note: meeting custom backgrounds and recordings are intentionally browser-memory media. They are not uploaded to `/api/upload`, are not persisted, and should not be diagnosed as backend media failures.

## Grants, Support, Admin Inbox, And AI Reports

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| Grant form submit | `components/GrantApplicationPage.tsx` | 308-337, 656 | Submits structured grant application payload. |
| Parent grant submit | `App.tsx` | 1782-1785, 3639 | Calls `/conscious-careers/grant-applications`. |
| Grant endpoint | `server/src/routes/consciousCareers.ts` | 35-136 | Authenticated grant application create. |
| Grant store | `server/src/services/consciousCareerGrantStore.ts` | 23, 54-68 | Persists `ConsciousCareerGrantApplication`. |
| Grant schema | `server/prisma/schema.prisma` | 168 | Grant application model. |
| Contact form submit | `App.tsx` | 2690-2705, 5041-5063 | Calls `/support/contact`. |
| Support endpoint | `server/src/routes/support.ts` | 15-82 | Creates admin inbox contact message. |
| AI issue report endpoint | `server/src/routes/ai.ts` | 567-682 | Creates admin inbox issue report with AI analysis. |
| Admin message creation | `server/src/services/adminMessageStore.ts` | 249-309 | Creates and lists admin messages. |
| Admin message routes | `server/src/routes/admin.ts` | 740-786 | Admin list/update inbox messages. |
| Admin dashboard message UI | `components/AdminDashboard.tsx` | 368-384, 740-899 | View and update admin inbox content. |
| Admin message schema | `server/prisma/schema.prisma` | 214 | Admin message model. |

Alignment note: these are text/structured content paths, not binary upload paths. They are persisted and viewed through admin/member UI and should be considered content flows in compliance review.

## AI And Knowledge Content

| Action | File | Lines | Notes |
| --- | --- | ---: | --- |
| AI chat route | `server/src/routes/ai.ts` | 411-446 | User prompt in, AI response out. |
| Daily wisdom route | `server/src/routes/ai.ts` | 455-493 | Generates daily wisdom. |
| Meeting summary route | `server/src/routes/ai.ts` | 502-558 | Summarizes meeting transcript content. |
| AI issue report route | `server/src/routes/ai.ts` | 567-682 | Routes issue content to admin inbox. |
| Trending route | `server/src/routes/ai.ts` | 692-731 | AI generated trending insights. |
| Admin AI status/reindex | `server/src/routes/ai.ts` | 740, 767 | Admin-elevated operational routes. |
| Knowledge file ingestion | `server/src/services/knowledgeService.ts` | 62, 185, 242-279 | Reads approved local/internal/trusted knowledge documents. |
| Knowledge chunking/search | `server/src/services/knowledgeService.ts` | 112-131, 325-385 | Builds context and source snippets. |

Alignment note: AI does not upload binary media, but it consumes and emits content. Admin-only reindex/status routes are mounted under protected `/api/ai` and additionally require admin elevation.

## Static And Public Asset Viewing

| Asset/path | File | Lines | Notes |
| --- | --- | ---: | --- |
| CNH logo imports | `App.tsx` | 32, 4021, 4503, 4686, 4700 | Build asset import and display. |
| Conscious Careers logo | `App.tsx` | 33, 4093 | Build asset import and display. |
| Platform primitive logo path | `components/ui/PlatformPrimitives.tsx` | 33-45 | Uses `/brand/conscious-network-hub-logo.png`. |
| Meeting brand loop | `components/ui/MeetingBrandLoop.tsx` | 10-11, 61-72 | Uses public brand image. |
| Homepage video | `App.tsx` | 3978-3987 | Uses `/video/home-bg.mp4` and `/images/home-video-fallback.svg`. |
| Entrepreneurship external imagery | `components/EntrepreneurshipSupportPage.tsx` | 124-126, 809, 1056, 1256, 1329 | Uses Unsplash URL backgrounds. |
| Entrepreneurship local image | `components/EntrepreneurshipSupportPage.tsx` | 18, 689-690 | Uses `foundation-gateway-guide.jpg`. |
| Public headers allow media | `public/_headers` | 2 | CSP allows `img-src 'self' data: blob: https:` and `media-src 'self' blob: https:`. |
| Existing public asset sizes | filesystem listing | n/a | Meeting brand JPG is 182,169 bytes; homepage MP4 is 13,630,872 bytes. |

Alignment note: static images/videos bypass backend upload routes. Broken static assets should be diagnosed through build output, Cloudflare Pages asset availability, and CSP, not upload object retrieval.

## Database Models And Migrations

| Model/field | File | Lines | Content role |
| --- | --- | ---: | --- |
| `User.avatarUrl` / `bannerUrl` / `profileMedia` | `server/prisma/schema.prisma` | 26, 42-44 | Public profile media references. |
| `User.profileBackgroundVideo` | `server/prisma/schema.prisma` | 67 | Profile background video reference. |
| `ProviderApplicant.resumeFile` / `coverLetterFile` | `server/prisma/schema.prisma` | 120, 147-148 | Private applicant document refs. |
| `ConsciousCareerGrantApplication` | `server/prisma/schema.prisma` | 168 | Grant content. |
| `AdminMessage` | `server/prisma/schema.prisma` | 214 | Admin inbox/report/contact content. |
| `Course.image` | `server/prisma/schema.prisma` | 242, 249 | Course image URL/string. |
| `UserCourse` | `server/prisma/schema.prisma` | 265 | Enrollment/progress content. |
| `Reflection.fileUrl` | `server/prisma/schema.prisma` | 359, 363 | Private upload URL. |
| `SocialPost` / `SocialPostMedia.objectKey` | `server/prisma/schema.prisma` | 450, 466-472 | Social post and media references. |
| Reflection migration | `server/prisma/migrations/20260126211607_add_profile_background_and_reflections/migration.sql` | 2-19 | Adds profile background and reflections. |
| Profile media hardening | `server/prisma/migrations/20260219163000_phase2_schema_hardening/migration.sql` | 59-92 | Adds JSON shape checks for `profileMedia`. |
| Social migration | `server/prisma/migrations/20260219121000_add_social_models/migration.sql` | 1-59 | Social post/media/like tables. |
| Provider applicant migration | `server/prisma/migrations/20260511031000_provider_applicants/migration.sql` | 3-60 | Provider applicant table and indexes. |

## Test Coverage Located

| Test area | File | Lines | Covered behavior |
| --- | --- | ---: | --- |
| Upload key access metadata | `server/src/__tests__/uploadBlobStore.logic.test.ts` | 27-84 | Public/private metadata and tampering rejection. |
| Public URL rewrite | `server/src/__tests__/publicUrl.logic.test.ts` | 51-78 | Rewrites frontend-hosted upload URLs to backend origin and extracts keys. |
| Reflection lifecycle | `server/src/__tests__/reflectionRoutes.lifecycle.test.ts` | 182-287 | Owner-only CRUD and private upload ownership checks. |
| Core persistence/media loop | `server/src/__tests__/coreUserPersistenceLoop.integration.test.ts` | 720-922 | Profile persistence, reflection upload/private read, social upload/public read, canonical social URLs. |
| Social privacy | `server/src/__tests__/phase4.integration.test.ts` | 430-568 | Private profile/post/follow boundaries. |
| Course privacy/progress | `server/src/__tests__/courses.logic.test.ts` | 268 | My-courses and progress privacy. |
| Provider CRM notes | `server/src/__tests__/providerCrm.logic.test.ts` | 619 | Provider-scoped notes CRUD. |

## Overlaps, Conflicts, And Alignment Breaks

### 1. Multiple media URL normalizers

Active normalizers:

- `server/src/services/publicUrl.ts:57-104`
- `services/apiClient.ts:216-223`
- `services/mediaAssets.ts:33-65`
- `components/community/CommunityLayout.tsx:60-61`
- `components/Profile.tsx:35`

Risk: backend and frontend both repair upload URLs. This is useful for production recovery, but drift can cause one page to render a stale frontend-hosted URL while another rewrites it correctly.

Launch recommendation: keep `server/src/services/publicUrl.ts` as the canonical backend response normalizer and keep frontend `backendAssetUrl` as the only client fallback.

### 2. Public and private object routes are intentionally different

Public render:

- `/uploads/object/:objectKey`
- `server/src/routes/upload.ts:251-263`
- Used by avatar/cover/social public media.

Private retrieval:

- `/api/upload/object/:objectKey`
- `server/src/routes/upload.ts:267-280`
- Used by reflections and provider applicant documents.

Risk: private files cannot be rendered with plain `<img src>` or `<video src>` because browser element requests cannot attach the bearer token. The current `openPrivateUpload` pattern is correct.

### 3. Social media is a two-step non-transactional flow

Steps:

1. `components/SocialLearningHub.tsx:365-380` uploads binary media.
2. `components/SocialLearningHub.tsx:401` creates the post with media metadata.
3. `server/src/routes/social.ts:383-441` writes post/media rows.

Risk: if upload succeeds and post creation fails, a public upload object can become orphaned. This is not currently a user-visible rendering break, but it is an operational cleanup risk.

### 4. Active profile component and orphaned profile component overlap

Active:

- `App.tsx:25, 3715`
- `components/community/CommunityLayout.tsx:278-332`

Orphaned duplicate:

- `components/Profile.tsx:31, 136-253`

Risk: future edits may patch one component and leave the other stale. Because `components/Profile.tsx` is not imported by `App.tsx`, it appears inactive, but it still carries upload code.

### 5. Profile media can be saved through user profile and social profile paths

User profile path:

- `components/community/CommunityLayout.tsx:896-903`
- `App.tsx:2547-2574`
- `server/src/routes/user.ts:1863-1938`

Social profile path:

- `components/SocialLearningHub.tsx:455-471`
- `server/src/routes/social.ts:320-375`

Risk: both paths expose profile-related content. Server normalization in `user.ts` and `social.ts` is similar, but not a single shared response serializer.

### 6. Meeting upload wording can be confused with backend uploads

Meeting custom backgrounds:

- `components/ConsciousMeetings.tsx:1681-1703`
- Uses `URL.createObjectURL`, not backend persistence.

Meeting local recordings:

- `components/ConsciousMeetings.tsx:1560-1650`
- Browser `MediaRecorder` download only.

Risk: launch support may diagnose meeting background or recording behavior as server upload failure. These flows are intentionally local/browser-only.

### 7. Course images are plain strings, not upload objects

Course images:

- `server/prisma/schema.prisma:249`
- `server/src/routes/courses.ts:25-42`
- `components/KnowledgePathways.tsx:192, 300-301, 379`
- `components/MyCourses.tsx:89-90, 159`

Risk: course images can be external/public/static URLs and are not repaired by upload object metadata. If a course image points to a bad external URL, upload object remediation will not fix it.

### 8. Admin social delete removes upload objects

Admin deletion:

- `server/src/routes/admin.ts:179-199`
- `server/src/routes/admin.ts:1137-1172`

Risk: this is intentional moderation cleanup, but it is a destructive media path. It should remain admin-elevated and audited. It should not be used during zero-deletion diagnostic passes.

### 9. Applicant files use generic object storage but a custom intake endpoint

Provider applicant document upload:

- `server/src/routes/providerApplicants.ts:258-273`
- `server/src/routes/providerApplicants.ts:397-409`

Risk: upload bugs may appear in applicant files even when `/api/upload/*` appears healthy, because intake uses a different route and multer field setup.

### 10. Static public assets and uploaded assets have different failure modes

Static assets:

- `components/ui/MeetingBrandLoop.tsx:10-11`
- `App.tsx:3978-3987`
- `public/_headers:2`

Uploaded assets:

- `server/src/routes/upload.ts:251-280`
- `services/apiClient.ts:216-223`

Risk: Cloudflare Pages asset failures, CSP issues, or missing public files will not be corrected by Render/backend upload route fixes.

## Current Alignment Map

| Content type | Upload/source | Persistence | Viewing path | Alignment status |
| --- | --- | --- | --- | --- |
| Profile avatar/cover | `/api/upload/avatar`, `/api/upload/cover` | `User.avatarUrl`, `User.bannerUrl`, `User.profileMedia` | `CommunityLayout`, sidebar, directory, social profile viewer | Mostly aligned; duplicate orphaned `Profile.tsx` exists. |
| Profile background video | `/api/upload/profile-background` | `User.profileBackgroundVideo` | `Profile.tsx` duplicate and profile media helpers | Partially aligned; active `/profile` path focuses avatar/cover, legacy component uploads background. |
| Private reflections | `/api/upload/reflection` then `/api/reflection` | `Reflection.fileUrl` | `openPrivateUpload` | Aligned for private access. |
| Social image/video/file | `/api/upload/social` then `/api/social/posts` | `SocialPostMedia.url/objectKey` | `SocialLearningHub`, `SocialProfileViewer`, feed/deep link/profile | Aligned in tests; orphan risk on failed post create. |
| Provider applicant docs | `/api/provider-applicants/apply` multipart | `ProviderApplicant.resumeFile/coverLetterFile` | Applicant status/admin review via `openPrivateUpload` | Aligned, custom route. |
| Course catalog content | Provider/admin/course seed data | `Course`, `UserCourse` | `KnowledgePathways`, `MyCourses`, admin dashboard | Aligned; published-only backend filter. |
| Provider CRM notes/content | Provider CRM forms | Provider CRM workspace tables | `ProviderCrmShell` | Aligned; text content only. |
| Meeting sessions/signals | Meeting API forms/actions | Meeting rows and metadata/signals | Meeting pages/room | Aligned; no binary upload persistence. |
| Meeting background uploads | Browser file picker | Browser memory only | Canvas compositor | Not a backend upload by design. |
| Local meeting recordings | Browser MediaRecorder | Browser download only | Download button | Not a backend upload by design. |
| Grant applications | Grant form | `ConsciousCareerGrantApplication` | Admin/future review path | Aligned as text/structured content. |
| Contact/issue reports | Contact form/AI report | `AdminMessage` | Admin dashboard/messages | Aligned as text/structured content. |
| Static brand/home media | `public/` and `src/assets` | Build output | Browser static asset requests | Separate from upload pipeline. |

## Recommended Follow-Up Checks

1. Decide whether to remove or quarantine `components/Profile.tsx` after confirming it is not needed. It is stale duplicate upload code.
2. Add a cleanup mechanism or audit queue for orphaned social upload objects when post creation fails after media upload.
3. Keep all new public media renders flowing through `backendAssetUrl` or `normalizeMediaAsset`.
4. Keep all private media opens flowing through `openPrivateUpload`; do not use raw `<img src="/api/upload/object/...">` for private files.
5. Consider centralizing profile media serialization so `server/src/routes/user.ts` and `server/src/routes/social.ts` cannot drift.
6. Add explicit tests for provider applicant private document retrieval if not already covered by applicant lifecycle tests.
7. Document meeting custom backgrounds as browser-local media so production upload debugging does not chase that path.

