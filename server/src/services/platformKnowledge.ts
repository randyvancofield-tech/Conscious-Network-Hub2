export interface PlatformKnowledgeDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  sourceType: 'hcn' | 'internal';
  lastReviewed: string;
}

const LAST_REVIEWED = '2026-05-31';

export const APPROVED_CNH_PUBLIC_SOURCE_URLS = [
  'https://www.higherconscious.network/',
  'https://www.higherconscious.network/about',
  'https://www.higherconscious.network/mission-vision',
  'https://www.higherconscious.network/privacy-policy',
  'https://www.higherconscious.network/data-ethics-human-autonomy',
  'https://www.higherconscious.network/terms-of-service',
];

const publicCnhDocuments: PlatformKnowledgeDocument[] = [
  {
    id: 'public:hcn-home',
    title: 'Higher Conscious Network public site',
    url: 'https://www.higherconscious.network/',
    sourceType: 'hcn',
    lastReviewed: LAST_REVIEWED,
    content: [
      'Higher Conscious Network presents a sovereignty ecosystem for human and professional growth.',
      'The public site describes user pathways for mental, spiritual, and educational expansion, provider pathways for owning intellectual property and monetizing expertise, and institutional pathways for ethical AI governed leadership, education, and well-being programs.',
      'It positions Conscious Network Hub as the collaborative learning community engine and Conscious Careers as the entrepreneurship and economic mobility engine.',
    ].join(' '),
  },
  {
    id: 'public:hcn-about',
    title: 'Higher Conscious Network about page',
    url: 'https://www.higherconscious.network/about',
    sourceType: 'hcn',
    lastReviewed: LAST_REVIEWED,
    content: [
      'Higher Conscious Network is framed as ethical infrastructure for human autonomy.',
      'Its model responds to centralized platform extraction, wellness and spiritual access gaps, equity barriers for underserved communities, and the need for ethical inclusive digital spaces.',
      'The public positioning emphasizes ethical AI, blockchain, zero-trust safeguards, provider autonomy, profile control, offering autonomy, transparent engagement metrics, tier-based learning, organizational programs, reinvestment, and Conscious Careers integration.',
    ].join(' '),
  },
  {
    id: 'public:hcn-mission',
    title: 'Higher Conscious Network mission and vision',
    url: 'https://www.higherconscious.network/mission-vision',
    sourceType: 'hcn',
    lastReviewed: LAST_REVIEWED,
    content: [
      'Higher Conscious Network states a mission to empower individuals, providers, and institutions with ethical technology that restores autonomy, protects identity, and creates equitable economic opportunity through community-centered decentralized social learning infrastructure.',
      'Its vision is a global ecosystem where data ownership, economic mobility, and values-aligned human development are accessible, especially for historically excluded communities.',
      'Conscious Careers is described as an entrepreneurship pathway supporting business ownership, matching, skill and life development, and future grant readiness.',
    ].join(' '),
  },
  {
    id: 'public:hcn-privacy',
    title: 'Higher Conscious Network privacy policy',
    url: 'https://www.higherconscious.network/privacy-policy',
    sourceType: 'hcn',
    lastReviewed: LAST_REVIEWED,
    content: [
      'The public privacy policy emphasizes limited data collection, communication and coordination use cases, and no sale, rent, trade, or monetization of user data.',
      'It states the public website itself does not collect sensitive personal data, financial information, biometric data, or health information.',
      'It also notes that advanced systems such as persistent user accounts, wallet identity, automated decision-making, and individually tied analytics require separate future disclosures when deployed.',
    ].join(' '),
  },
  {
    id: 'public:hcn-data-ethics',
    title: 'Higher Conscious Network data ethics and human autonomy',
    url: 'https://www.higherconscious.network/data-ethics-human-autonomy',
    sourceType: 'hcn',
    lastReviewed: LAST_REVIEWED,
    content: [
      'The data ethics statement centers human dignity, agency, and long-term well-being.',
      'It commits to necessary data collection, rejection of extractive surveillance models, autonomy, consent, choice, accountability, explicit consent, transparency, opt-in participation, and clear boundaries between human decision-making and machine assistance.',
      'It frames ethics as infrastructure and says future systems should avoid hidden profiling or data commodification.',
    ].join(' '),
  },
  {
    id: 'public:hcn-terms',
    title: 'Higher Conscious Network terms of service',
    url: 'https://www.higherconscious.network/terms-of-service',
    sourceType: 'hcn',
    lastReviewed: LAST_REVIEWED,
    content: [
      'The public website terms state that website content is informational and educational only and does not constitute legal, medical, clinical, financial, or professional advice.',
      'They also distinguish public website materials from advanced platform services that may be under development or require separate availability and policy disclosures.',
    ].join(' '),
  },
];

const internalLaunchDocuments: PlatformKnowledgeDocument[] = [
  {
    id: 'internal:platform-overview',
    title: 'CNH launch platform overview',
    sourceType: 'internal',
    lastReviewed: LAST_REVIEWED,
    content: [
      'Conscious Network Hub is a secure social-learning and human-development platform for members, providers, learning, ethical AI support, reflections, privacy-centered identity, and role-appropriate platform operations.',
      'The active app uses protected backend routes, signed sessions, persisted sessions, Prisma/PostgreSQL persistence, membership tier enforcement, and separate member, provider-application, provider, and solo-admin access boundaries.',
      'AI responses should explain CNH using public and internal-safe platform facts only. They must not expose private users, applicants, provider records, admin records, private reflections, private uploads, wallet identifiers, secrets, tokens, or unpublished operational data.',
    ].join(' '),
  },
  {
    id: 'internal:membership-tiers',
    title: 'CNH membership tiers',
    sourceType: 'internal',
    lastReviewed: LAST_REVIEWED,
    content: [
      'Current launch membership tiers are Free / Community Tier, Guided Tier, and Accelerated Tier.',
      'Free / Community Tier starts an account with community access, public learning areas, and selected events.',
      'Guided Tier provides structured access to curated content, thematic learning pathways, and selected provider-led sessions.',
      'Accelerated Tier provides full access to expert-led sessions, live programs, collaborations, and advanced thematic content.',
      'Actual access is still enforced by server-side tier checks and current membership state.',
    ].join(' '),
  },
  {
    id: 'internal:provider-lifecycle',
    title: 'CNH provider and applicant lifecycle',
    sourceType: 'internal',
    lastReviewed: LAST_REVIEWED,
    content: [
      'The launch provider journey is apply, confirmation, applicant portal, status tracking, admin review, approval or rejection/request-more-information, approved provider sign-in, wallet binding or verification, and provider CRM access.',
      'Applicants are not approved providers until admin review sets the approved state.',
      'Approved providers sign in through provider/member authentication and must complete provider wallet verification before CRM access.',
      'Approved providers do not receive admin permissions. Admin provider review, admin console access, and provider CRM sessions remain separate permission domains.',
      'Pending or rejected applicants and ordinary members must not access provider CRM or admin areas.',
    ].join(' '),
  },
  {
    id: 'internal:privacy-and-ai-boundaries',
    title: 'CNH privacy and AI access boundaries',
    sourceType: 'internal',
    lastReviewed: LAST_REVIEWED,
    content: [
      'CNH AI may use public CNH information, approved internal-safe platform facts, published courses, public posts, and non-private public profile fields where indexing is enabled.',
      'Private reflections, private uploads, hidden profile fields, applicant documents, provider records, admin data, emails, wallet identifiers, recovery codes, and session data are not general AI sources.',
      'Admin-only AI operational routes such as status and reindexing require authenticated admin role checks.',
      'The AI provides reflective and educational support, not emergency services or professional medical, mental health, legal, financial, clinical, or safety-critical advice.',
    ].join(' '),
  },
  {
    id: 'internal:learning-and-careers',
    title: 'CNH learning and Conscious Careers pathway',
    sourceType: 'internal',
    lastReviewed: LAST_REVIEWED,
    content: [
      'CNH learning areas organize courses, public learning content, reflective growth, provider-led sessions, and community engagement into tier-aware pathways.',
      'Conscious Careers is the entrepreneurship and economic mobility pathway connected to CNH. It supports skill development, business ownership readiness, provider or entrepreneur pathways, and grant or reinvestment positioning as implemented features become available.',
      'The AI should avoid claiming partnerships, grants, payouts, or services are active unless current platform context explicitly confirms that state.',
    ].join(' '),
  },
];

export const getApprovedPlatformKnowledgeDocuments = (): PlatformKnowledgeDocument[] => [
  ...publicCnhDocuments,
  ...internalLaunchDocuments,
];

const extractUserRequest = (message: string): string => {
  const match = /User request:\s*([\s\S]*?)(?:\n\nPlatform context:|$)/i.exec(message);
  return (match?.[1] || message).trim();
};

const hasAny = (text: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(text));

const boundaryPatterns = [
  /\b(list|show|give|export|reveal|dump|delete|disable|lock)\b.*\b(users?|members?|providers?|applicants?|admins?|emails?|wallets?|passwords?|tokens?|recovery codes?|private reflections?)\b/i,
  /\b(admin password|bypass|private data|wallet address|session token|recovery code)\b/i,
];

const providerPatterns = [
  /\b(provider|applicant|application|apply|approval|approve|reject|crm|wallet verification|wallet binding)\b/i,
];

const membershipPatterns = [
  /\b(membership|tier|free|community tier|guided tier|accelerated tier|checkout|access level)\b/i,
];

const privacyPatterns = [
  /\b(privacy|data sovereignty|data ownership|private|security|consent|autonomy|reflection|profile visibility|source)\b/i,
];

const careersPatterns = [
  /\b(conscious careers|career|entrepreneur|entrepreneurship|grant|economic mobility|business ownership|franchise)\b/i,
];

const platformPatterns = [
  /\b(conscious network hub|higher conscious network|cnh|hcn|this platform|the platform|what do you know)\b/i,
  ...providerPatterns,
  ...membershipPatterns,
  ...privacyPatterns,
  ...careersPatterns,
];

export const isPlatformKnowledgeRequest = (message: string): boolean => {
  const request = extractUserRequest(message);
  return hasAny(request, platformPatterns);
};

export const buildPlatformFallbackReply = (message: string): string | null => {
  const request = extractUserRequest(message);
  if (!hasAny(request, platformPatterns)) return null;

  if (hasAny(request, boundaryPatterns)) {
    return [
      'I can explain the admin and safety model, but I cannot reveal, list, alter, or delete private users, providers, applicants, wallet data, recovery codes, private reflections, or admin records from an AI chat.',
      '',
      'In CNH, those actions belong in authenticated admin tools with server-side role checks, elevated admin authorization where required, audit logging, and clear review controls. For abuse handling, the safe pattern is: inspect the record in the admin console, disable or revoke access through the approved admin endpoint, preserve audit history, and avoid exposing private data in chat responses.',
    ].join('\n');
  }

  if (hasAny(request, providerPatterns)) {
    return [
      'CNH separates applicants, approved providers, and admins.',
      '',
      'Provider lifecycle:',
      '- Apply to become a provider.',
      '- Receive confirmation and use the applicant portal for status tracking.',
      '- Admin reviews the application and private docs through protected review paths.',
      '- Admin may approve, reject, or request more information where supported.',
      '- Approval creates the approved provider state, but does not grant admin permissions.',
      '- Approved providers sign in through the provider path and must complete wallet binding or verification before provider CRM access.',
      '',
      'Pending or rejected applicants and ordinary members should not be able to enter provider CRM or admin areas.',
    ].join('\n');
  }

  if (hasAny(request, membershipPatterns)) {
    return [
      'CNH launch membership is tier-aware.',
      '',
      '- Free / Community Tier: community access, public learning areas, and selected events.',
      '- Guided Tier: curated content, thematic learning pathways, and selected provider-led sessions.',
      '- Accelerated Tier: expert-led sessions, live programs, collaborations, and advanced thematic content.',
      '',
      'The UI can describe these tiers, but real access must come from the backend membership record, active membership state, and server-side tier enforcement.',
    ].join('\n');
  }

  if (hasAny(request, privacyPatterns)) {
    return [
      'CNH is designed around privacy, autonomy, and role boundaries.',
      '',
      'The AI may use approved CNH public pages, internal-safe platform facts, published courses, public posts, and non-private public profile fields when indexing is enabled. It should not expose private reflections, private uploads, applicant documents, provider records, admin data, emails, wallet identifiers, recovery codes, secrets, or session data.',
      '',
      'AI support is reflective and educational. It is not a replacement for emergency help or professional medical, mental health, legal, financial, or clinical advice.',
    ].join('\n');
  }

  if (hasAny(request, careersPatterns)) {
    return [
      'Conscious Careers is CNH-connected entrepreneurship and economic mobility support.',
      '',
      'Its purpose is to help members and providers move from learning into business ownership readiness, skill and life development, provider pathways, and future grant or reinvestment opportunities as those features are implemented.',
      '',
      'The AI should not claim active grants, guaranteed funding, formal partnerships, or business outcomes unless the current platform context explicitly confirms them.',
    ].join('\n');
  }

  return [
    'Conscious Network Hub is a secure social-learning and human-development platform connected to Higher Conscious Network.',
    '',
    'At launch, CNH supports members, membership tiers, learning pathways, reflective tools, ethical AI assistance, provider applications, applicant status tracking, admin review, approved provider sign-in, wallet verification for provider CRM access, and privacy-aware profile/reflection behavior.',
    '',
    'The role model matters: members, provider-application status records, approved providers, and the solo founder admin have different access. Approved providers are not admins, admin review tools remain separate, and private records are not exposed through AI chat.',
    '',
    'The public CNH identity emphasizes autonomy, data ownership, provider dignity, ethical technology, and Conscious Careers as an entrepreneurship and economic mobility pathway. CNH AI can help explain the platform and suggest safe next steps, but it is not emergency support or a substitute for qualified professional advice.',
  ].join('\n');
};
