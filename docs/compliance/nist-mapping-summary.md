# NIST CSF 2.0 Cybersecurity Mapping - Conscious Network Hub

**Effective Date:** July 8, 2026
**Last Updated:** July 8, 2026

This document summarizes how Conscious Network Hub ("CNH") maps its cybersecurity and technology governance practices to the NIST Cybersecurity Framework ("CSF") 2.0. CNH is preparing for national and global launch, so this mapping is a practical operating guide, not a claim of certification.

## 1. NIST CSF 2.0 Structure

NIST CSF 2.0 is structured around three primary elements:

- **The CSF Core:** A taxonomy of high-level cybersecurity outcomes. In CSF 2.0, the Core is organized into six functions: Govern, Identify, Protect, Detect, Respond, and Recover.
- **Organizational Profiles:** A way to compare the organization's current cybersecurity state against its desired target state, helping identify gaps and improvement priorities.
- **Implementation Tiers:** Four levels that describe how thoroughly cybersecurity risk management is integrated into business practices: Tier 1 Partial, Tier 2 Risk Informed, Tier 3 Repeatable, and Tier 4 Adaptive.

## 2. Launch Implementation Tier

CNH's launch target is **Tier 2 to Tier 3** depending on the function and system area:

- **Current Profile:** Risk-informed controls are implemented for authentication, admin access, provider access, notifications, recovery codes, session handling, payments, uploads, AI boundaries, and audit logging.
- **Target Profile:** Repeatable security operations with documented review cycles, incident playbooks, vendor review, vulnerability management, backup/recovery tests, and privacy/security evidence tracking.
- **Not Yet Claimed:** CNH does not claim SOC 2, ISO 27001, HIPAA, PCI certification, NIST certification, or EU AI Act certification unless separately completed and published.

## 3. CSF Core Mapping

### Govern

The Govern function establishes and monitors cybersecurity risk management strategy, policies, expectations, roles, and accountability.

CNH launch controls include:
- Role-aware access boundaries for guests, users, applicants, providers, and admins.
- Separate provider and admin security boundaries.
- Admin elevation requirements for sensitive administrative operations.
- Security, privacy, AI, blockchain, vendor, and terms policies.
- Audit logging for protected actions, denials, wallet flows, provider access, and admin actions.
- Launch governance that treats frontend navigation as usability only, with backend authorization as the security boundary.

Target improvements:
- Formal incident-response owner assignment.
- Documented vendor risk register.
- Scheduled security and privacy reviews.
- Written global jurisdiction review before additional country-specific launches.

### Identify

The Identify function develops organizational understanding of cybersecurity risk to systems, people, assets, data, and capabilities.

CNH launch controls include:
- Backend route and service mapping for auth, user, membership, provider, admin, AI, upload, social, meetings, notifications, and Conscious Careers flows.
- Account type mapping for guest, user/member, applicant, approved provider, and admin.
- Data category awareness for profile data, provider applications, grant applications, reflections, uploads, notifications, audit logs, wallet identifiers, and payment metadata.
- Recognition that provider/applicant documents, admin records, recovery codes, wallet private keys, passwords, and sensitive session tokens require heightened protection.

Target improvements:
- Maintain a formal data inventory and retention table.
- Maintain a vendor/API inventory with processing purpose and region.
- Perform recurring threat modeling for admin, wallet, provider, AI, upload, payment, and applicant workflows.

### Protect

The Protect function outlines safeguards to ensure service delivery and protect against cyber threats.

CNH launch controls include:
- HTTPS-only production expectation.
- Helmet security headers, CORS allowlists, validation, and rate limiting.
- Hashed passwords and hashed recovery codes.
- Signed session tokens backed by persisted session records.
- `sessionStorage`-oriented frontend auth behavior for active browser sessions.
- Role-based backend middleware and canonical identity checks.
- Admin-only and provider-only server checks.
- Provider wallet binding and wallet verification before provider CRM/tool access.
- No wallet verification for regular users or applicants.
- Recovery code support when email delivery is unavailable.
- Sensitive data minimization in AI, public listings, email, and notifications.

Target improvements:
- Formal backup and restore drills.
- Stronger secrets rotation schedule.
- Dependency and vulnerability management cadence.
- Security awareness guidance for admins and providers.

### Detect

The Detect function defines activities to identify the occurrence of cybersecurity events.

CNH launch controls include:
- Audit telemetry for auth, admin, provider wallet, social, provider CRM, support, and protected route actions.
- Authentication denial logging for missing/invalid sessions, role mismatches, expired sessions, and unauthorized access.
- Rate limiting and validation failures for suspicious request patterns.
- Admin inbox/report paths for users to flag issues, unsafe content, AI concerns, or security problems.

Target improvements:
- Centralized production log review and alerting.
- Automated anomaly detection for admin attempts, provider wallet failures, repeated recovery attempts, upload misuse, and suspicious API activity.
- Documented alert severity levels.

### Respond

The Respond function takes action regarding detected cybersecurity incidents, including containment, mitigation, communication, and forensics.

CNH launch controls include:
- Session revocation on password/recovery reset.
- Account lockout/unlock flows.
- Admin ability to review users, roles, provider states, messages, submissions, audit events, and issue reports.
- Provider access revocation support.
- Graceful email-failure handling so critical database transactions are not broken by communication failures.
- In-app notifications and portals as launch-primary communication paths.

Target improvements:
- Written incident response playbooks.
- Evidence preservation checklist.
- Regulatory notification matrix by jurisdiction.
- Tabletop exercises for admin compromise, provider wallet mismatch, data exposure, AI incident, payment incident, and vendor outage.

### Recover

The Recover function restores capabilities or services impaired by cybersecurity incidents and improves resilience.

CNH launch controls include:
- Recovery codes for non-admin account recovery when email is unavailable.
- Manual/stricter admin recovery expectations.
- Session revocation after account recovery.
- Portal and notification-based communication for applicants/providers when email is disabled.
- Build/test verification gates before launch phase transitions.

Target improvements:
- Documented backup recovery objectives.
- Disaster recovery tests.
- Post-incident review templates.
- Formal continuity plan for email provider outage, payment provider outage, wallet provider failure, hosting outage, and database restore.

## 4. AI Risk Management Alignment

CNH also uses NIST AI RMF concepts: Govern, Map, Measure, and Manage.

- **Govern:** AI is a support layer, not the authority for provider approval, admin permission changes, payment decisions, safety-critical decisions, medical/legal/financial advice, or emergency response.
- **Map:** AI use cases are identified by context, role, user impact, and data sensitivity.
- **Measure:** Harmful, biased, unsafe, misleading, or privacy-invasive outputs should be reportable and reviewed.
- **Manage:** AI prompts, knowledge sources, access boundaries, and response behavior should be corrected when incidents or risks are found.

## 5. Global Launch Considerations

For global launch, CNH should treat cybersecurity as a cross-border trust requirement:
- Apply least privilege to admin, provider, applicant, and member access.
- Avoid emailing sensitive documents, private wallet/session tokens, passwords, or recovery codes.
- Respect regional privacy rights and data transfer requirements.
- Review local rules before activating regulated provider, wellness, funding, education, youth, payment, or employment-related workflows in a new jurisdiction.
- Preserve evidence of security decisions, incident reviews, and policy updates.

## 6. Review Cadence

This mapping should be reviewed before launch, after material security changes, after major incidents, when adding a new country/region, and at least annually.
