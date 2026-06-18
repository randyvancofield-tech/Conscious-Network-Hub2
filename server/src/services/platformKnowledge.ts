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
    id: 'internal:provider-pilot-current-state',
    title: 'CNH provider pilot current-state boundaries',
    sourceType: 'internal',
    lastReviewed: LAST_REVIEWED,
    content: [
      'For the controlled provider pilot, CNH supports approved providers entering provider CRM, creating native CNH meeting rooms, starting and ending provider sessions, inviting users or groups, and issuing signed guest links where configured.',
      'Provider-hosted meeting rooms currently emphasize lifecycle truth, browser-local camera and microphone access, signed access, local-only participant recording when enabled, and clear 5D/WebXR fallback messaging.',
      'Member self-booking and public booking workflows are gated for launch. Members may discover public-safe provider information and join authorized sessions, but booking, messaging, and private provider contact flows require authenticated eligibility and future hardening.',
      'Meeting AI notes, transcript capture, participant-wide notes sync, cloud/server recording, replay/VOD, and full multi-peer spatial collaboration are locked or future-build items unless current runtime context explicitly says otherwise.',
      'GSP in pilot conversations should be treated as a guided support pathway concept connected to CNH provider service, growth, and learning workflows, not as a separate fully launched product or guaranteed service outcome.',
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
  const match = /User request:\s*([\s\S]*?)(?:\n\nPage context:|\n\nPlatform context:|$)/i.exec(message);
  return (match?.[1] || message).trim();
};

const extractPageContext = (message: string): string => {
  const match = /Page context:\s*([\s\S]*?)(?:\n\nPlatform context:|$)/i.exec(message);
  return (match?.[1] || '').trim();
};

const pageContextValue = (context: string, key: string): string => {
  const match = new RegExp(`${key}=([^;]+)`, 'i').exec(context);
  return (match?.[1] || '').trim();
};

const isAmbiguousPageQuestion = (text: string): boolean =>
  /^(what is this|what is this page|what is this page for|where am i|what am i looking at)\??$/i.test(text.trim());

const describePageContext = (context: string): string | null => {
  const route = pageContextValue(context, 'route').toLowerCase();
  const category = pageContextValue(context, 'category').toLowerCase();

  if (route.includes('/dashboard') || category.includes('daily-wisdom') || category.includes('general')) {
    return 'This is your Conscious Network Hub dashboard. It should help you orient quickly: profile and account status, courses, meetings, provider actions when eligible, support, notifications, and the AI assistant.';
  }
  if (route.includes('/provider/apply')) {
    return 'This is the provider application path. It is for people who want to be reviewed before supporting members through CNH provider pathways.';
  }
  if (route.includes('/conscious-meetings')) {
    return 'This is the Conscious Meetings area. It supports provider-hosted session readiness, upcoming sessions, signed access, and lifecycle-aware meeting entry. AI notes, transcripts, server recording, replay, and VOD remain locked until those systems are fully implemented.';
  }
  if (route.includes('/courses') || route.includes('/my-courses')) {
    return 'This is the learning area. Public visitors can browse published course information, while enrollment, progress, and My Courses belong to authenticated member access.';
  }
  if (route.includes('/membership-access') || route.includes('/membership')) {
    return 'This is the membership access area. It directs people into CNH account access and tier-aware membership pathways.';
  }
  if (route.includes('/conscious-careers') || route.includes('/entrepreneurship-support')) {
    return 'This is Conscious Careers entrepreneurship support. It helps members clarify readiness, build a Conscious Plan, understand public resource boundaries, and move toward appropriate support pathways.';
  }
  if (route.includes('/community')) {
    return 'This is a community discovery area for public-safe member or social learning surfaces. Private messages, private uploads, and hidden profile fields are not public AI sources.';
  }

  return null;
};

const hasAny = (text: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(text));

const boundaryPatterns = [
  /\b(list|show|give|export|reveal|dump|delete|disable|lock)\b.*\b(users?|members?|providers?|applicants?|admins?|emails?|wallets?|passwords?|tokens?|recovery codes?|private reflections?)\b/i,
  /\b(admin password|bypass|private data|wallet address|session token|recovery code)\b/i,
  /\b(unpublished|draft|private|hidden)\b.*\b(courses?|content|provider records?|profiles?)\b/i,
];

const providerPatterns = [
  /\b(providers?|applicants?|applications?|apply|approval|approve|reject|crm|wallet verification|wallet binding|spiritual coach|coach|facilitator)\b/i,
];

const providerHostPatterns = [
  /\b(providers?)\b.*\b(host|create|start|run|lead)\b.*\b(sessions?|meetings?|rooms?)\b/i,
  /\b(how do i|how can i|where do i)\b.*\b(host|create|start|run|lead)\b.*\b(a\s+)?(session|meeting|room)\b/i,
  /\bhost\s+(a\s+)?(session|meeting|room)\b/i,
  /\b(host controls?|provider-led sessions?|native cnh rooms?)\b/i,
];

const bookingPatterns = [
  /\b(members?|users?)\b.*\b(book|schedule|reserve|request)\b.*\b(providers?|sessions?|appointments?)\b/i,
  /\bcan\s+(members?|users?)\s+(book|schedule|reserve|request)\s+me\b/i,
  /\bcan\s+i\s+be\s+(booked|scheduled|reserved|requested)\b/i,
  /\b(book providers?|provider booking|self[-\s]?booking)\b/i,
];

const availabilityPatterns = [
  /\b(available now|what is available|what works|still gated|future build|not available|locked|gated)\b/i,
];

const providerToolPatterns = [
  /\b(provider|crm|host)\s+tools?\b/i,
  /\bwhat\s+(provider|crm|host)\s+tools?\s+(are\s+)?(available|live|ready|enabled)\b/i,
  /\btools?\s+available\s+for\s+(providers?|hosts?)\b/i,
];

const membershipPatterns = [
  /\b(membership|tier|free|community tier|guided tier|accelerated tier|checkout|access level)\b/i,
];

const coursePatterns = [
  /\b(courses?|learning pathway|my courses|enrollment|progress|resume|published course|unpublished course|draft course)\b/i,
];

const privacyPatterns = [
  /\b(privacy|data sovereignty|data ownership|private|security|consent|autonomy|reflection|profile visibility|source)\b/i,
];

const careersPatterns = [
  /\b(conscious careers|career|entrepreneur|entrepreneurship|grant|economic mobility|business ownership|franchise)\b/i,
];

const gspPatterns = [
  /\b(gsp|guided support pathway|growth support pathway|guided service pathway)\b/i,
];

const platformPatterns = [
  /\b(conscious network hub|higher conscious network|cnh|hcn|this platform|the platform|what do you know)\b/i,
  ...providerPatterns,
  ...providerHostPatterns,
  ...bookingPatterns,
  ...membershipPatterns,
  ...coursePatterns,
  ...privacyPatterns,
  ...careersPatterns,
  ...availabilityPatterns,
  ...gspPatterns,
];

export const isPlatformKnowledgeRequest = (message: string): boolean => {
  const request = extractUserRequest(message);
  return hasAny(request, platformPatterns);
};

export const buildPlatformFallbackReply = (message: string): string | null => {
  const request = extractUserRequest(message);
  const pageContext = extractPageContext(message);

  if (isAmbiguousPageQuestion(request)) {
    const pageDescription = describePageContext(pageContext);
    if (pageDescription) return pageDescription;

    if (pageContext) {
      const route = pageContextValue(pageContext, 'route') || pageContextValue(pageContext, 'pageTitle');
      return route
        ? `This appears to be the CNH area identified as ${route}. What would you like to understand about it?`
        : 'I can help, but I need one detail: which page or feature are you asking about?';
    }

    return 'Which page or feature are you asking about?';
  }

  if (!hasAny(request, platformPatterns)) return null;

  if (hasAny(request, boundaryPatterns)) {
    return [
      'I can explain the admin and safety model, but I cannot reveal, list, summarize, alter, or delete private users, providers, applicants, wallet data, recovery codes, unpublished courses, private reflections, private uploads, or admin records from an AI chat.',
      '',
      'In CNH, those actions belong in authenticated admin tools with server-side role checks, elevated admin authorization where required, audit logging, and clear review controls. For abuse handling, the safe pattern is: inspect the record in the admin console, disable or revoke access through the approved admin endpoint, preserve audit history, and avoid exposing private data in chat responses.',
    ].join('\n');
  }

  if (/\bhigher conscious network|hcn\b/i.test(request) && !/\bconscious network hub|cnh\b/i.test(request)) {
    return [
      'Higher Conscious Network is the broader mission and ecosystem identity behind Conscious Network Hub.',
      '',
      'It is positioned around ethical technology, human autonomy, provider dignity, learning, community-centered development, and economic mobility. Conscious Network Hub is the active social-learning platform layer, and Conscious Careers is the entrepreneurship and economic mobility pathway connected to that ecosystem.',
      '',
      'The platform should speak clearly about what is live today and avoid promising grants, partnerships, clinical support, or private-data access unless those systems are actually implemented and authorized.',
    ].join('\n');
  }

  if (hasAny(request, availabilityPatterns)) {
    return [
      'Here is the current pilot truth-state for CNH:',
      '',
      'Available now:',
      '- Member and provider account access through protected backend sessions.',
      '- Provider application, applicant status, admin review, and approved-provider state.',
      '- Approved-provider CRM entry after the required provider access checks.',
      '- Provider host controls for native CNH meeting rooms, including create, start, end, invited users/groups, and signed guest links where configured.',
      '- Published course and public-safe provider/community discovery surfaces.',
      '- AI platform guidance grounded in approved CNH context and privacy boundaries.',
      '',
      'Still gated or future build:',
      '- Member self-booking of providers.',
      '- Meeting AI notes, transcript capture, session-scoped notes persistence, and participant-wide notes sync.',
      '- Cloud/server recording, replay, VOD, and institutional archives.',
      '- Full multi-peer spatial collaboration beyond local WebXR/5D readiness checks.',
      '',
      'Private records, emails, wallets, unpublished courses, applicant documents, CRM notes, and admin records are not AI-visible public sources.',
    ].join('\n');
  }

  if (hasAny(request, providerHostPatterns)) {
    return [
      'Yes. In the current provider pilot, approved providers can use provider host controls to create native CNH meeting rooms, start scheduled sessions, end live sessions, invite users or groups, and create signed guest links where configured.',
      '',
      'Important boundaries:',
      '- The provider must be approved and have provider access active.',
      '- Session entry is lifecycle-bound: scheduled rooms wait for the host, live rooms are joinable when authorized, and ended/archived rooms close active controls.',
      '- Camera, microphone, local recording, and 5D/WebXR readiness are browser/device dependent.',
      '- AI meeting notes, transcript capture, cloud recording, VOD, and full spatial collaboration remain locked or future-build items unless explicitly enabled by current backend support.',
    ].join('\n');
  }

  if (hasAny(request, bookingPatterns)) {
    return [
      'Member self-booking of providers is not active as a public launch feature yet.',
      '',
      'Current behavior: members can view public-safe provider discovery where available and join authorized provider-created sessions. Booking, direct messaging, private contact, and appointment workflows remain gated until the platform has the required eligibility checks, privacy controls, provider availability rules, and audit-safe persistence.',
      '',
      'For the provider pilot, providers should publish or host CNH meeting rooms through approved host controls rather than relying on public self-booking.',
    ].join('\n');
  }

  if (hasAny(request, providerToolPatterns)) {
    return [
      'Current provider tools are available only after the provider is approved and the required provider access checks are complete.',
      '',
      'Available in the provider pilot:',
      '- Provider CRM entry after approved-provider sign-in and wallet verification.',
      '- Provider workspace tools such as records, notes, follow-ups, content/course drafting support, collaboration items, analytics where enabled, and provider support queues.',
      '- Native CNH meeting host controls for creating rooms, starting and ending sessions, inviting platform users/groups, and issuing signed guest links where configured.',
      '- Provider device readiness checks for secure context, camera, microphone, WebGL, WebXR/5D support, and browser-local preview behavior.',
      '- AI platform guidance for provider pathway questions, with privacy and safety boundaries.',
      '',
      'Still gated or future build: member self-booking, direct provider messaging, AI meeting notes, transcript capture, participant-wide notes sync, cloud/server recording, replay/VOD, and full multi-peer spatial collaboration.',
    ].join('\n');
  }

  if (hasAny(request, providerPatterns)) {
    if (/\b(spiritual coach|coach|facilitator)\b/i.test(request)) {
      return [
        'A spiritual coach should start by entering the provider pathway with clarity and boundaries.',
        '',
        'Practical first steps:',
        '- Apply through the provider application path and describe the service area, audience, ethics, and support boundaries.',
        '- Use the applicant portal to track review status and respond to any requested information.',
        '- After approval, sign in as an approved provider and complete wallet verification before CRM access.',
        '- Use provider CRM and host controls to prepare pilot sessions, invite the right participants, and keep member privacy protected.',
        '- Be explicit that CNH support is educational, reflective, spiritual, coaching, or wellness-oriented as appropriate, not emergency, clinical, legal, or financial advice.',
      ].join('\n');
    }

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
      '- During the provider pilot, approved providers can use host controls for native CNH meeting rooms, invite workflows, and signed guest links where configured.',
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

  if (hasAny(request, gspPatterns)) {
    return [
      'GSP should be described cautiously in this pilot as a guided support pathway concept connected to CNH service, growth, provider support, and learning workflows.',
      '',
      'It should not be presented as a separate fully launched product, guaranteed service, guaranteed outcome, or replacement for professional medical, legal, financial, clinical, or emergency support. The safe next step is to connect the person to CNH membership, learning, provider discovery, or provider application pathways based on their role and current access.',
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
