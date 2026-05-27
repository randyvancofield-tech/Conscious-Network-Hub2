# Provider CRM Completion Status

Date captured: 2026-05-27

## Completed CRM Areas

Provider CRM now has launch-usable workspaces for:

- Notes: scoped provider/admin note CRUD with private visibility.
- Content/Courses: provider/admin course management with draft, published, and archived status.
- Collaboration: scoped provider/admin coordination records.
- Follow-Ups: scoped provider/admin task queue with due dates, priority, and status.
- Analytics: real aggregate metrics only; no fabricated production metrics.
- Admin tool visibility: sole Provider CRM admin can enable or disable workspace tools durably.

## Rich Course Authoring

Course authoring uses the existing `Course.syllabus` JSON field to avoid a destructive schema change.

Supported fields:

- `Course.title`
- `Course.description` as the short catalog description
- `Course.syllabus.fullDescription`
- `Course.syllabus.category`
- `Course.syllabus.estimatedDuration`
- `Course.syllabus.learningObjectives`
- `Course.syllabus.contentSections`
- `Course.tier`
- `Course.status`: `draft`, `published`, `archived`
- `Course.ownerId` and `Course.ownerType`
- `Course.createdAt` and `Course.updatedAt`

Public/member course catalog routes return only `published` courses. Draft and archived courses remain provider/admin-managed content and are not returned by the public catalog route.

## Admin Tool Visibility

Provider CRM workspace visibility is stored in the database table `ProviderCrmToolVisibility`.

Configurable tools:

- Notes
- Content/Courses
- Collaboration
- Follow-Ups
- Analytics

Behavior:

- The sole Provider CRM admin can view and update tool visibility through `/api/provider/crm/admin/tools`.
- Providers receive only enabled provider-visible tools from `/api/provider/crm/tools`.
- Backend routes for disabled Notes, Content/Courses, Collaboration, Follow-Ups, and Analytics return `403` instead of relying on frontend hiding.
- Settings persist through backend restart because they are stored in Postgres.
- Environment overrides `PROVIDER_CRM_ENABLED_TOOLS` and `PROVIDER_CRM_DISABLED_TOOLS` remain available, but durable admin settings take precedence.

## Permissions Enforced

- Provider CRM requires a native provider session.
- Provider routes require provider scopes.
- Sole-admin tool visibility controls require the configured sole admin identity.
- Providers can manage only provider-owned course/content records.
- Admins can manage course/content records broadly through Provider CRM.
- Public course surfaces do not receive draft or archived course content.
- Analytics returns aggregate counts only and does not include note bodies, follow-up details, or private document metadata.

## Known Limitations

No destructive migration was applied to the `Course` model. Rich authoring is intentionally implemented through structured `syllabus` JSON. Any future promotion to first-class course metadata columns requires CTO approval and is tracked as a database/data-model decision in `docs/launch/PHASE_CONTINUITY_REGISTER.md`.
