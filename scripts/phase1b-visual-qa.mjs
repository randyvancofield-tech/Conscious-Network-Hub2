import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const BASE_URL = process.env.CNH_VISUAL_QA_URL || 'http://127.0.0.1:3000';
const CAPTURE_SCREENSHOTS = process.env.CNH_VISUAL_QA_SCREENSHOTS !== '0';
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const ALL_VIEWPORTS = [
  { name: '360-mobile', width: 360, height: 800 },
  { name: '390-mobile', width: 390, height: 844 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1024-laptop', width: 1024, height: 768 },
  { name: '1280-laptop', width: 1280, height: 800 },
  { name: '1440-desktop', width: 1440, height: 900 },
  { name: '1920-wide', width: 1920, height: 1080 },
];

const ALL_PAGES = [
  { name: 'public-entry', path: '/', auth: false, screenshots: ['390-mobile', '1024-laptop', '1440-desktop'] },
  { name: 'dashboard-header-nav', path: '/dashboard', screenshots: ['390-mobile', '1024-laptop', '1440-desktop'] },
  { name: 'profile-banner', path: '/profile', screenshots: ['390-mobile', '1024-laptop', '1440-desktop'] },
  { name: 'provider-access', path: '/provider-access', auth: false, screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'provider-application', path: '/provider/apply', auth: false, screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'provider-status', path: '/provider/application-status', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'provider-crm', path: '/provider/crm', screenshots: ['390-mobile', '1024-laptop', '1440-desktop'] },
  { name: 'admin-dashboard', path: '/admin', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'admin-provider-review', path: '/admin/provider-applicants', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'courses', path: '/courses', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'my-courses', path: '/my-courses', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'community', path: '/community', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'social-feed', path: '/social', screenshots: ['390-mobile', '1024-laptop', '1440-desktop'] },
  { name: 'meetings-board', path: '/conscious-meetings/upcoming', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'meetings-portal-lobby', path: '/conscious-meetings/portal', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'membership', path: '/membership', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'privacy-policy', path: '/privacy-policy', screenshots: ['390-mobile', '1024-laptop'] },
  { name: 'terms-policy', path: '/terms-of-service', screenshots: ['390-mobile'] },
  { name: 'ai-policy', path: '/policies/ai-transparency', screenshots: ['390-mobile'] },
];

const splitFilter = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const viewportFilter = new Set(splitFilter(process.env.CNH_VISUAL_QA_VIEWPORTS));
const pageFilter = new Set(splitFilter(process.env.CNH_VISUAL_QA_PAGES));
const VIEWPORTS = viewportFilter.size
  ? ALL_VIEWPORTS.filter((viewport) => viewportFilter.has(viewport.name))
  : ALL_VIEWPORTS;
const PAGES = pageFilter.size
  ? ALL_PAGES.filter((page) => pageFilter.has(page.name))
  : ALL_PAGES;

const now = Date.now();
const isoNow = new Date(now).toISOString();
const futureExp = Math.floor((now + 7 * 24 * 60 * 60 * 1000) / 1000);

const qaUser = {
  id: 'visual-admin',
  name: 'Alexandria Conscious Network Steward',
  handle: 'alexandria-conscious-steward',
  email: 'visual.qa@conscious.network',
  role: 'admin',
  tier: 'Accelerated Tier',
  subscriptionStatus: 'active',
  membershipStatus: 'active',
  hasActiveMembership: true,
  identityVerified: true,
  emailVerified: true,
  providerApproved: true,
  providerApprovalStatus: 'approved',
  reputationScore: 100,
  hasProfile: true,
  location: 'Remote / Global',
  bio: 'Visual QA account used to verify responsive structure across member, provider, applicant, and admin surfaces.',
  interests: ['Ethical AI', 'Provider Operations', 'Community Wellness'],
  privacySettings: {
    profileVisibility: 'public',
    showEmail: false,
    allowMessages: true,
    blockedUsers: [],
  },
  profileMedia: {
    avatar: { url: '/images/course-identity.svg', storageProvider: 'local', objectKey: null },
    cover: { url: '/images/provider-readiness.svg', storageProvider: 'local', objectKey: null },
  },
};

const courses = [
  {
    id: 'ethical-autonomy',
    title: 'Ethical Autonomy For Providers And Members',
    provider: 'CNH Learning Guild',
    description: 'A dense but readable course card used to validate responsive text, badges, buttons, and status rows.',
    fullDescription: 'This pathway verifies long text behavior in the course detail layout without clipping important content.',
    category: 'Ethical Technology',
    estimatedDuration: '6 weeks',
    learningObjectives: ['Design accountable workflows', 'Protect member privacy', 'Build provider trust'],
    contentSections: [
      { title: 'Orientation', body: 'A grounded setup for responsible platform participation.' },
      { title: 'Practice', body: 'Applied exercises for privacy, access, and care boundaries.' },
    ],
    tier: 'Professional',
    enrolled: 128,
    enrolledCount: 128,
    image: '/images/course-identity.svg',
    progress: 42,
    progressScore: 42,
    status: 'active',
    enrollmentStatus: 'Open',
  },
  {
    id: 'provider-readiness',
    title: 'Provider Readiness And Conscious Operations',
    provider: 'Provider Council',
    description: 'Operational preparation for providers entering a trust-centered service network.',
    category: 'Provider Practice',
    estimatedDuration: '4 weeks',
    learningObjectives: ['Prepare service records', 'Coordinate sessions', 'Review accountability rhythms'],
    tier: 'Elite',
    enrolled: 84,
    enrolledCount: 84,
    image: '/images/provider-readiness.svg',
    progress: 72,
    progressScore: 72,
    status: 'active',
    enrollmentStatus: 'Open',
  },
];

const providers = [
  {
    id: 'provider-long-name',
    name: 'Dr. Seraphina Luminous Hartwell',
    email: 'seraphina@example.com',
    location: 'Denver, CO / Remote',
    bio: 'Integrative wellness provider with a long public biography used to validate provider cards, detail pages, service badges, and action controls across laptop and mobile widths.',
    interests: ['Integrative Wellness', 'Trauma-Informed Care', 'Somatic Education'],
    services: ['Guided integration sessions', 'Provider training cohorts', 'Community nervous system education'],
    profileMedia: {
      avatar: { url: '/images/provider-readiness.svg', storageProvider: 'local', objectKey: null },
      cover: { url: '/images/course-identity.svg', storageProvider: 'local', objectKey: null },
    },
  },
  {
    id: 'provider-operations',
    name: 'Marcus Ellison Conscious Systems',
    email: 'marcus@example.com',
    location: 'Austin, TX',
    bio: 'Provider operations mentor focused on practical workflow design, ethical data handling, and trusted member experience.',
    interests: ['Provider Operations', 'Ethical Data', 'Business Growth'],
    services: ['Operations review', 'Course design', 'Institutional readiness'],
    profileMedia: {
      avatar: { url: '/images/course-provider.svg', storageProvider: 'local', objectKey: null },
      cover: { url: '/images/provider-readiness.svg', storageProvider: 'local', objectKey: null },
    },
  },
];

const posts = [
  {
    id: 'post-1',
    authorId: 'member-1',
    authorName: 'Morgan Community Steward With A Long Name',
    authorAvatarUrl: '/images/course-identity.svg',
    text: 'This social learning post intentionally includes a longer sentence and a reference link https://conscious-network.org/resources/responsive-layout-review so card wrapping, link previews, and author rows can be checked.',
    visibility: 'public',
    likeCount: 24,
    createdAt: isoNow,
    media: [],
  },
  {
    id: 'post-2',
    authorId: 'member-2',
    authorName: 'Riley Provider Collaborator',
    authorAvatarUrl: '/images/provider-readiness.svg',
    text: 'Image node for social card visual QA.',
    visibility: 'public',
    likeCount: 11,
    createdAt: new Date(now - 3600000).toISOString(),
    media: [{ mediaType: 'image', url: '/images/provider-readiness.svg' }],
  },
];

const meetingSessions = [
  {
    id: 'meeting-1',
    routeKey: 'conscious-layout-review',
    title: 'Conscious Layout Review And Provider Readiness Circle',
    description: 'A provider-created session with longer copy to validate cards, topic filters, archived rows, and meeting room routes.',
    focusArea: 'Provider Operations',
    mode: 'virtual',
    status: 'scheduled',
    providerDid: 'did:cnh:provider:visual',
    providerUserId: 'provider-long-name',
    providerDisplayName: 'Dr. Seraphina Luminous Hartwell',
    maxViewers: 48,
    publicStream: true,
    scheduledAtMs: now + 86400000,
    internalRoomPath: '/conscious-meetings/session/conscious-layout-review',
    internalRoomUrl: `${BASE_URL}/conscious-meetings/session/conscious-layout-review`,
    participants: [],
    invitedMembers: [],
    createdAtMs: now - 86400000,
    updatedAtMs: now,
    startedAtMs: null,
    endedAtMs: null,
    nativeRoom: {
      provider: 'native-webrtc-p2p',
      enabled: true,
      signaling: 'https-polling',
      serverRecordingEnabled: false,
      localRecordingAllowed: true,
      immersiveEnabled: true,
      securityLevel: 'signed-session',
    },
  },
  {
    id: 'meeting-archive',
    routeKey: 'archive-ethical-ai',
    title: 'Ethical AI Reflection Replay',
    description: 'Archived replay entry for visual QA.',
    focusArea: 'Ethical AI',
    mode: 'virtual',
    status: 'ended',
    providerDid: 'did:cnh:provider:visual',
    providerUserId: 'provider-operations',
    providerDisplayName: 'Marcus Ellison Conscious Systems',
    maxViewers: 60,
    publicStream: false,
    scheduledAtMs: now - 604800000,
    participants: [],
    invitedMembers: [],
    createdAtMs: now - 700000000,
    updatedAtMs: now - 604800000,
    startedAtMs: now - 604900000,
    endedAtMs: now - 604800000,
    vodPath: '/vod/conscious-meetings/archive-ethical-ai.mp4',
  },
];

const crmTools = [
  ['home', 'Command Center', 'Treatment and business growth overview'],
  ['members', 'Relationships', 'Client, institution, and organization records'],
  ['sessions', 'Sessions', 'Provider session coordination'],
  ['roundtable', 'Conscious Roundtable', 'Reserve private provider rooms'],
  ['follow-ups', 'Follow-Ups', 'Action tracking and next steps'],
  ['notes', 'Private Notes', 'Provider-owned notes and reflections'],
  ['content-courses', 'Content & Courses', 'Course authoring and publishing'],
  ['analytics', 'Analytics', 'Operational metrics and aggregate views'],
  ['knowledge-center', 'Knowledge Center', 'Best-practice resources'],
  ['collaboration', 'Collaboration', 'Coordination and handoff records'],
].map(([id, label, description], index) => ({
  id,
  label,
  description,
  phase: index < 4 ? 'Live' : 'Ready',
  providerVisible: true,
  adminOnly: false,
  enabledByDefault: true,
  enabled: true,
}));

const crmWorkspace = {
  scope: {
    role: 'admin',
    providerUserId: 'visual-admin',
    providerDid: 'did:cnh:provider:visual-admin',
    providerDisplayName: 'Alexandria Conscious Network Steward',
    visibility: 'administrator-holistic',
  },
  metrics: {
    treatment: { activeClientRecords: 18, dueFollowUps: 5, upcomingRoundtables: 3 },
    businessGrowth: { organizationsTracked: 12, institutionContractOpportunities: 6, urgentOpportunities: 2 },
  },
  guidanceAlerts: [
    {
      id: 'alert-1',
      severity: 'warning',
      title: 'Review High Priority Follow-Ups',
      detail: 'Several provider relationships have next actions due this week.',
      action: 'Open follow-up workspace and assign ownership.',
    },
  ],
  records: [
    {
      id: 'record-1',
      providerId: 'visual-admin',
      clientUserId: 'member-1',
      clientDisplayName: 'Morgan Community Steward With A Long Name',
      organizationName: null,
      kind: 'client',
      title: 'Integration support cohort with a longer title',
      treatmentFocus: 'Grounding and values-aligned weekly reflection.',
      businessFocus: 'Prepare provider referral documentation.',
      status: 'active',
      priority: 'high',
      nextActionAt: new Date(now + 172800000).toISOString(),
      timezone: 'America/New_York',
      details: {},
      createdAt: isoNow,
      updatedAt: isoNow,
    },
  ],
  roundtable: {
    label: 'Conscious Roundtable',
    roomCount: 12,
    dayStartHour: 8,
    hourCount: 12,
    timezone: 'America/New_York',
    reservations: [
      {
        id: 'reservation-1',
        providerId: 'visual-admin',
        roomNumber: 3,
        startAt: new Date(now + 86400000).toISOString(),
        endAt: new Date(now + 90000000).toISOString(),
        timezone: 'America/New_York',
        title: 'Institutional Partner Readiness Roundtable',
        meetingSessionId: 'meeting-1',
        roomUrl: '/conscious-meetings/session/conscious-layout-review',
        status: 'scheduled',
        chatMode: 'native-room-signals',
        details: {},
        createdAt: isoNow,
        updatedAt: isoNow,
      },
    ],
  },
  resources: [
    {
      id: 'resource-1',
      title: 'Privacy-Preserving Provider Notes',
      category: 'Privacy',
      summary: 'Guidance for concise notes, access boundaries, and member trust.',
      checklist: ['Minimize sensitive data', 'Record clear next actions', 'Use approved channels'],
    },
  ],
};

const notes = [
  {
    id: 'note-1',
    providerId: 'visual-admin',
    authorUserId: 'visual-admin',
    title: 'Client readiness note with longer heading',
    body: 'Confirm session goals, privacy boundaries, and consent language.',
    category: 'Care',
    status: 'active',
    relatedType: null,
    relatedId: null,
    createdAt: isoNow,
    updatedAt: isoNow,
  },
];

const contentItems = courses.map((course) => ({
  ...course,
  ownerId: 'visual-admin',
  ownerType: 'provider',
  enrolledCount: course.enrolled,
  status: 'published',
  createdAt: isoNow,
  updatedAt: isoNow,
}));

const collaborations = [
  {
    id: 'collab-1',
    providerId: 'visual-admin',
    authorUserId: 'visual-admin',
    title: 'Cross-provider referral review',
    description: 'Coordinate a warm handoff and validate consent before sharing details.',
    status: 'open',
    relatedType: null,
    relatedId: null,
    createdAt: isoNow,
    updatedAt: isoNow,
  },
];

const followUps = [
  {
    id: 'follow-1',
    providerId: 'visual-admin',
    ownerUserId: 'visual-admin',
    assignedToUserId: null,
    title: 'Send member summary and scheduling options',
    details: 'Long follow-up label validates card wrapping and priority badge spacing.',
    dueAt: new Date(now + 86400000).toISOString(),
    status: 'open',
    priority: 'urgent',
    relatedType: 'record',
    relatedId: 'record-1',
    createdAt: isoNow,
    updatedAt: isoNow,
  },
];

const analytics = {
  scope: { role: 'admin', visibility: 'administrator-aggregate' },
  generatedAt: isoNow,
  relationships: { total: 18, active: 14, byKind: { client: 9, organization: 6, institution: 3 }, byStatus: { active: 14, watching: 4 } },
  notes: { total: 7, active: 6, archived: 1 },
  collaboration: { total: 5, open: 3, inProgress: 1, completed: 1, archived: 0 },
  followUps: { total: 9, open: 5, inProgress: 2, completed: 2, canceled: 0, due: 3 },
  content: { total: 4, draft: 1, published: 3, archived: 0 },
  meetings: { total: 6, upcoming: 3 },
  admin: {
    providerApplicants: { total: 8, pending: 3, approved: 4, declined: 1 },
    approvedProviders: 12,
    membershipsByTier: { Free: 42, Guided: 18, Accelerated: 9 },
    aiInteractions: { total: 128 },
  },
};

const applicants = [
  {
    id: 'applicant-1',
    userId: 'applicant-user-1',
    email: 'very.long.provider.applicant@example-conscious-network.org',
    firstName: 'Evangeline',
    lastName: 'Longform-Provider-Applicant',
    phone: '+1 555 0100',
    providerCategory: 'Integrative Wellness And Ethical Technology',
    organizationName: 'Global Conscious Care Collective',
    professionalTitle: 'Founder / Somatic Education Provider',
    serviceArea: 'Remote / International',
    servicesOffered: ['Guided sessions', 'Cohort facilitation', 'Provider education'],
    targetAudience: 'Members seeking grounded, trauma-informed integration support.',
    credentialsText: 'Certified facilitator with a long credential description used for wrapping checks.',
    resumeFile: { originalName: 'Evangeline-Longform-Provider-Resume.pdf', objectKey: 'resume.pdf' },
    coverLetterFile: { originalName: 'Cover-Letter-Conscious-Network-Hub.pdf', objectKey: 'cover.pdf' },
    alignmentAnswers: {
      calling: 'I support ethical care systems and consent-led human development.',
      privacy: 'I minimize sensitive data and use approved channels only.',
    },
    status: 'under_review',
    adminNotes: 'Review discovery interview scheduling and credential verification.',
    submittedAt: isoNow,
    reviewedAt: null,
    calendlyShownAt: null,
  },
];

const adminDashboard = {
  summary: {
    usersTotal: 96,
    roleCounts: { user: 72, applicant: 8, provider: 12, admin: 4 },
    activeMemberships: 69,
    providerApproved: 12,
  },
  recentUsers: [
    {
      id: 'member-1',
      email: 'morgan.community.steward@example-conscious-network.org',
      name: 'Morgan Community Steward With A Long Name',
      role: 'user',
      tier: 'Accelerated Tier',
      subscriptionStatus: 'active',
      providerApproved: false,
      providerApprovalStatus: null,
      twoFactorMethod: 'none',
      createdAt: isoNow,
    },
    {
      id: 'provider-long-name',
      email: 'seraphina@example.com',
      name: 'Dr. Seraphina Luminous Hartwell',
      role: 'provider',
      tier: 'Professional',
      subscriptionStatus: 'active',
      providerApproved: true,
      providerApprovalStatus: 'approved',
      twoFactorMethod: 'wallet',
      createdAt: isoNow,
    },
  ],
};

function findChromePath() {
  return CHROME_PATHS.find((candidate) => candidate && fs.existsSync(candidate));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForDebugPort(port, timeoutMs = 10000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return await requestJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }
  throw lastError || new Error('Chrome debug port did not become ready.');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out connecting to CDP.')), 10000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      this.ws.addEventListener('error', (event) => {
        clearTimeout(timeout);
        reject(event.error || new Error('CDP websocket error.'));
      });
    });
    this.ws.addEventListener('message', (event) => this.onMessage(event));
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolve(message.result || {});
      return;
    }
    if (message.method && this.eventWaiters.has(message.method)) {
      const waiters = this.eventWaiters.get(message.method);
      this.eventWaiters.delete(message.method);
      waiters.forEach((resolve) => resolve(message.params || {}));
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  waitForEvent(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.eventWaiters.get(method) || [];
        this.eventWaiters.set(method, waiters.filter((entry) => entry !== wrappedResolve));
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      const wrappedResolve = (params) => {
        clearTimeout(timeout);
        resolve(params);
      };
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push(wrappedResolve);
      this.eventWaiters.set(method, waiters);
    });
  }

  close() {
    this.ws?.close();
  }
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createBootstrapSource() {
  const payload = {
    userId: qaUser.id,
    email: qaUser.email,
    role: qaUser.role,
    sessionId: 'visual-session',
    exp: futureExp,
  };
  const token = `qa.${base64Url(payload)}.sig`;
  const fixtures = {
    qaUser,
    token,
    courses,
    providers,
    posts,
    meetingSessions,
    crmTools,
    crmWorkspace,
    notes,
    contentItems,
    collaborations,
    followUps,
    analytics,
    applicants,
    adminDashboard,
  };

  return `(() => {
    const fixtures = ${JSON.stringify(fixtures)};
    const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    });
    const normalizePath = (input) => {
      const raw = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(raw, window.location.origin);
      return url.pathname.startsWith('/api') ? url.pathname.slice(4) || '/' : url.pathname;
    };

    window.__CNH_VISUAL_QA__ = true;
    window.__CNH_VISUAL_QA_ERRORS__ = [];
    window.addEventListener('error', (event) => {
      window.__CNH_VISUAL_QA_ERRORS__.push(String(event.message || 'window error'));
    });
    window.addEventListener('unhandledrejection', (event) => {
      window.__CNH_VISUAL_QA_ERRORS__.push(String(event.reason?.message || event.reason || 'unhandled rejection'));
    });

    localStorage.setItem('hcn_auth_token', fixtures.token);
    localStorage.setItem('hcn_active_user', JSON.stringify(fixtures.qaUser));
    localStorage.setItem('hcn_platform_session', JSON.stringify({
      isAuthenticated: true,
      role: 'admin',
      tier: 'accelerated',
      permissions: ['admin:dashboard', 'provider:portal']
    }));
    sessionStorage.setItem('hcn_provider_session_token', 'visual-provider-session');
    sessionStorage.setItem('hcn_admin_elevation_token', 'visual-admin-elevation');

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const path = normalizePath(input);
      try {
        if (path === '/health') return jsonResponse({ ok: true, status: 'online' });
        if (path === '/user/current') return jsonResponse({ user: fixtures.qaUser });
        if (path === '/user/courses') return jsonResponse({ courses: fixtures.courses });
        if (path === '/courses') return jsonResponse({ courses: fixtures.courses });
        if (path.startsWith('/courses/') && path.endsWith('/enroll')) return jsonResponse({ course: fixtures.courses[0] });
        if (path === '/providers') return jsonResponse({ providers: fixtures.providers });
        if (path.includes('/providers/') && path.endsWith('/request')) return jsonResponse({ success: true });
        if (path.startsWith('/social/newsfeed')) return jsonResponse({ posts: fixtures.posts });
        if (path.startsWith('/social/profile/')) return jsonResponse({
          profile: {
            ...fixtures.qaUser,
            id: 'member-1',
            name: 'Morgan Community Steward With A Long Name',
            email: 'morgan@example.com',
            role: 'user',
            profileMedia: {
              avatar: { url: '/images/course-identity.svg', storageProvider: 'local', objectKey: null },
              cover: { url: '/images/provider-readiness.svg', storageProvider: 'local', objectKey: null }
            },
            websiteUrl: 'https://conscious-network.org/community/morgan-steward-long-profile-link'
          },
          posts: fixtures.posts,
          nextCursor: ''
        });
        if (path === '/admin/dashboard') return jsonResponse(fixtures.adminDashboard);
        if (path === '/admin/elevate') return jsonResponse({ elevationToken: 'visual-admin-elevation' });
        if (path === '/admin/provider-applicants') return jsonResponse({ applicants: fixtures.applicants });
        if (path.startsWith('/admin/provider-applicants/')) return jsonResponse({ applicant: fixtures.applicants[0] });
        if (path === '/provider-applicants/current') return jsonResponse({ applicant: fixtures.applicants[0], calendlyUrl: 'https://calendly.com/cnh/discovery' });
        if (path === '/provider-applicants/current/calendly-shown') return jsonResponse({ success: true });
        if (path === '/provider/crm/tools') return jsonResponse({ success: true, role: 'admin', tools: fixtures.crmTools });
        if (path === '/provider/crm/admin/tools') return jsonResponse({ success: true, soleAdminEmail: fixtures.qaUser.email, visibilityControl: { source: 'visual-qa', persistentStorage: true }, tools: fixtures.crmTools });
        if (path === '/provider/crm/summary') return jsonResponse({ success: true, role: 'admin', did: 'did:cnh:visual', sessionId: 'visual-provider-session', summary: { activeToolCount: fixtures.crmTools.length, shellStatus: 'visual-qa-active', dataModelsEnabled: true, notesEnabled: true, relationshipManagementEnabled: true, analyticsEnabled: true } });
        if (path.startsWith('/provider/crm/workspace')) return jsonResponse({ success: true, workspace: fixtures.crmWorkspace });
        if (path === '/provider/crm/notes') return jsonResponse({ success: true, notes: fixtures.notes });
        if (path === '/provider/crm/content') return jsonResponse({ success: true, items: fixtures.contentItems });
        if (path === '/provider/crm/collaboration') return jsonResponse({ success: true, items: fixtures.collaborations });
        if (path === '/provider/crm/follow-ups') return jsonResponse({ success: true, followUps: fixtures.followUps });
        if (path === '/provider/crm/analytics') return jsonResponse({ success: true, analytics: fixtures.analytics });
        if (path === '/provider/session/groups') return jsonResponse({ groups: [{ id: 'group-1', name: 'Provider Review Circle', members: [{ username: 'morgan', displayName: 'Morgan Steward' }] }] });
        if (path === '/meeting/user/sessions/upcoming') return jsonResponse({ sessions: fixtures.meetingSessions.filter((session) => session.status !== 'ended') });
        if (path === '/meeting/user/sessions/archive') return jsonResponse({ sessions: fixtures.meetingSessions.filter((session) => session.status === 'ended') });
        if (path === '/meeting/user/sessions/joinable') return jsonResponse({ sessions: fixtures.meetingSessions.filter((session) => session.status !== 'ended') });
        if (path.startsWith('/meeting/user/sessions/')) {
          const session = fixtures.meetingSessions[0];
          if (path.endsWith('/room-config')) return jsonResponse({ success: true, sessionId: session.id, routeKey: session.routeKey, nativeRoom: session.nativeRoom });
          if (path.endsWith('/signals')) return jsonResponse({ success: true, signals: [] });
          if (path.endsWith('/join')) return jsonResponse({ session });
          return jsonResponse({ session });
        }
        if (path.startsWith('/ai/wisdom')) return jsonResponse({ text: 'Daily wisdom layout check: keep the interface spacious, clear, and grounded.', groundingChunks: [], confidenceScore: 96, sourceCount: 0, processingTimeMs: 42 });
        if (path === '/ai/trending') return jsonResponse({ topics: ['responsive design', 'privacy posture', 'provider trust'] });
        if (path === '/integrity/profile/record') return jsonResponse({ record: null });
        if (path === '/identity-security/session') return jsonResponse({ success: true, session: { identityDid: 'did:cnh:visual-admin', assuranceLevel: 'verified' } });
      } catch (error) {
        return jsonResponse({ error: String(error?.message || error) }, 500);
      }

      return originalFetch(input, init).catch(() => jsonResponse({ success: true, mocked: true }));
    };
  })();`;
}

function metricsSource() {
  return `(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const doc = document.documentElement;
    const body = document.body;
    const maxScrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const selectorFor = (element) => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? '#' + element.id : '';
      const classes = String(element.className || '').split(/\\s+/).filter(Boolean).slice(0, 3).map((entry) => '.' + entry.replace(/[^a-zA-Z0-9_-]/g, '_')).join('');
      const text = String(element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
      return { selector: tag + id + classes, text };
    };
    const horizontalOverflow = Math.max(0, maxScrollWidth - viewportWidth);
    const offenders = horizontalOverflow > 2
      ? Array.from(document.querySelectorAll('body *'))
        .filter((element) => isVisible(element))
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > viewportWidth + 2 || rect.left < -2)
        .slice(0, 12)
        .map(({ element, rect }) => ({ ...selectorFor(element), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }))
      : [];
    const clipped = Array.from(document.querySelectorAll('button,a,h1,h2,h3,h4,h5,p,span,label,td,th,.cnh-person-name,.cnh-status-badge,.cnh-action-label'))
      .filter((element) => isVisible(element))
      .filter((element) => {
        const text = String(element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
        if (text.length < 6) return false;
        const style = getComputedStyle(element);
        const hidesOverflow = ['hidden', 'clip'].includes(style.overflow) || ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
        return hidesOverflow && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2);
      })
      .slice(0, 12)
      .map((element) => ({ ...selectorFor(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
    return {
      url: location.pathname,
      title: document.title,
      viewportWidth,
      viewportHeight,
      horizontalOverflow,
      bodyHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
      canPageScroll: Math.max(doc.scrollHeight, body?.scrollHeight || 0) > viewportHeight + 2,
      offenders,
      clipped,
      errors: window.__CNH_VISUAL_QA_ERRORS__ || [],
    };
  })();`;
}

async function createPage(port) {
  let target;
  try {
    target = await requestJson(`http://127.0.0.1:${port}/json/new?about:blank`, 'PUT');
  } catch {
    target = await requestJson(`http://127.0.0.1:${port}/json/new?about:blank`, 'GET');
  }
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: createBootstrapSource() });
  return client;
}

async function navigate(client, url) {
  const load = client.waitForEvent('Page.loadEventFired', 15000).catch(() => undefined);
  await client.send('Page.navigate', { url });
  await load;
  await delay(1100);
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed.');
  }
  return result.result?.value;
}

async function run() {
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error('Chrome or Edge executable was not found.');
  }

  const outputDir = process.env.CNH_VISUAL_QA_OUTPUT_DIR
    ? path.resolve(ROOT, process.env.CNH_VISUAL_QA_OUTPUT_DIR)
    : path.join(ROOT, 'logs', 'phase1b-visual-qa');
  fs.mkdirSync(outputDir, { recursive: true });
  const partialReportPath = path.join(outputDir, 'report.partial.json');

  const port = 9300 + Math.floor(Math.random() * 500);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnh-phase1b-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars=false',
    '--window-size=1280,800',
    'about:blank',
  ], { stdio: 'ignore' });

  const results = [];
  let client;
  try {
    await waitForDebugPort(port);
    client = await createPage(port);

    for (const page of PAGES) {
      for (const viewport of VIEWPORTS) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.width < 768,
        });
        const url = new URL(page.path, BASE_URL).toString();
        await navigate(client, url);

        if (page.name === 'meetings-portal-lobby') {
          await evaluate(client, `(() => {
            const button = Array.from(document.querySelectorAll('button')).find((entry) => /Live Lobby/i.test(entry.textContent || ''));
            button?.click();
          })();`);
          await delay(600);
        }

        const metrics = await evaluate(client, metricsSource());
        const entry = { page: page.name, path: page.path, viewport: viewport.name, ...metrics };
        results.push(entry);
        console.log(`${page.name} ${viewport.name}: overflow=${entry.horizontalOverflow} clipped=${entry.clipped.length} offenders=${entry.offenders.length} errors=${entry.errors.length}`);

        if (CAPTURE_SCREENSHOTS && page.screenshots.includes(viewport.name)) {
          const screenshot = await client.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            fromSurface: true,
          });
          const filename = `${page.name}__${viewport.name}.png`;
          fs.writeFileSync(path.join(outputDir, filename), Buffer.from(screenshot.data, 'base64'));
          entry.screenshot = filename;
        }
        fs.writeFileSync(partialReportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

        if (page.name === 'social-feed' && viewport.name === '1024-laptop') {
          await evaluate(client, `(() => {
            const button = Array.from(document.querySelectorAll('button')).find((entry) => /Morgan Community Steward/i.test(entry.textContent || ''));
            button?.click();
          })();`);
          await delay(900);
          const modalMetrics = await evaluate(client, metricsSource());
          const screenshot = await client.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            fromSurface: true,
          });
          const modalFilename = `social-profile-modal__${viewport.name}.png`;
          fs.writeFileSync(path.join(outputDir, modalFilename), Buffer.from(screenshot.data, 'base64'));
          results.push({ page: 'social-profile-modal', path: page.path, viewport: viewport.name, ...modalMetrics, screenshot: modalFilename });
        }

        if (page.name === 'provider-crm' && viewport.name === '1024-laptop') {
          for (const label of ['Conscious Roundtable', 'Content & Courses']) {
            await evaluate(client, `(() => {
              const button = Array.from(document.querySelectorAll('button')).find((entry) => new RegExp(${JSON.stringify(label)}, 'i').test(entry.textContent || ''));
              button?.click();
            })();`);
            await delay(900);
            const toolMetrics = await evaluate(client, metricsSource());
            const screenshot = await client.send('Page.captureScreenshot', {
              format: 'png',
              captureBeyondViewport: true,
              fromSurface: true,
            });
            const toolFilename = `provider-crm-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}__${viewport.name}.png`;
            fs.writeFileSync(path.join(outputDir, toolFilename), Buffer.from(screenshot.data, 'base64'));
            results.push({ page: `provider-crm-${label}`, path: page.path, viewport: viewport.name, ...toolMetrics, screenshot: toolFilename });
          }
        }
      }
    }
  } finally {
    client?.close();
    chrome.kill();
  }

  const failures = results.filter((entry) => entry.horizontalOverflow > 2 || entry.offenders.length > 0 || entry.clipped.length > 0 || entry.errors.length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    screenshotsDir: outputDir,
    viewportCount: VIEWPORTS.length,
    pageCount: PAGES.length,
    checked: results.length,
    failures: failures.map((entry) => ({
      page: entry.page,
      viewport: entry.viewport,
      path: entry.path,
      horizontalOverflow: entry.horizontalOverflow,
      offenders: entry.offenders,
      clipped: entry.clipped,
      errors: entry.errors.slice(0, 5),
      screenshot: entry.screenshot,
    })),
    results,
  };
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    checked: report.checked,
    failures: report.failures.length,
    screenshotsDir: outputDir,
    report: path.join(outputDir, 'report.json'),
    failureSummary: report.failures.slice(0, 20).map((entry) => ({
      page: entry.page,
      viewport: entry.viewport,
      horizontalOverflow: entry.horizontalOverflow,
      clipped: entry.clipped.length,
      offenders: entry.offenders.length,
      errors: entry.errors.length,
      screenshot: entry.screenshot,
    })),
  }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
