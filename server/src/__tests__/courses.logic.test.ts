import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';

const mockCourses = [
  {
    id: 'published-course',
    ownerId: 'provider-1',
    ownerType: 'provider',
    title: 'Published Course',
    provider: 'Launch Provider',
    description: 'Visible short description.',
    image: '/course.jpg',
    tier: 'Professional',
    enrolledCount: 0,
    status: 'published',
    syllabus: {
      fullDescription: 'Visible rich course body.',
      category: 'Launch Readiness',
      estimatedDuration: '60 minutes',
      learningObjectives: ['Understand the launch path'],
      contentSections: [{ title: 'Overview', body: 'Published section body.' }],
    },
  },
  {
    id: 'draft-course',
    ownerId: 'provider-1',
    ownerType: 'provider',
    title: 'Draft Course',
    provider: 'Launch Provider',
    description: 'Draft content must stay private.',
    image: '/draft.jpg',
    tier: 'Professional',
    enrolledCount: 0,
    status: 'draft',
    syllabus: {
      fullDescription: 'Draft body.',
      contentSections: [{ title: 'Draft', body: 'Draft section.' }],
    },
  },
];

const users = new Map<string, any>();
const memberships = new Map<string, any>();
const enrollments = new Map<string, any>();

const mockLocalStore = {
  getUserById: jest.fn(async (id: string) => users.get(id) || null),
};

const mockDb = {
  user: {
    findUnique: jest.fn(async (args: any) => users.get(args?.where?.id) || null),
  },
  membership: {
    findUnique: jest.fn(async (args: any) => memberships.get(args?.where?.userId) || null),
  },
  course: {
    count: jest.fn(async () => mockCourses.length),
    createMany: jest.fn(async () => ({ count: 0 })),
    findMany: jest.fn(async (args: any) =>
      mockCourses.filter((course) => !args?.where?.status || course.status === args?.where?.status)
    ),
    findUnique: jest.fn(async (args: any) =>
      mockCourses.find((course) => course.id === args?.where?.id) || null
    ),
    findFirst: jest.fn(async (args: any) =>
      mockCourses.find((course) => course.id === args?.where?.id && course.status === args?.where?.status) || null
    ),
    update: jest.fn(async (args: any) => {
      const course = mockCourses.find((entry) => entry.id === args?.where?.id);
      if (!course) throw new Error('course not found');
      Object.assign(course, args?.data || {});
      return { ...course };
    }),
  },
  userCourse: {
    count: jest.fn(async (args: any) =>
      Array.from(enrollments.values()).filter(
        (entry) =>
          entry.courseId === args?.where?.courseId &&
          (!args?.where?.status?.in || args.where.status.in.includes(entry.status))
      ).length
    ),
    findMany: jest.fn(async (args: any) =>
      Array.from(enrollments.values())
        .filter((entry) => entry.userId === args?.where?.userId)
        .filter((entry) => {
          const course = mockCourses.find((item) => item.id === entry.courseId);
          return !args?.where?.course?.status || course?.status === args.where.course.status;
        })
        .map((entry) => ({
          ...entry,
          course: mockCourses.find((item) => item.id === entry.courseId),
        }))
    ),
    findUnique: jest.fn(async (args: any) => {
      const key = `${args?.where?.userId_courseId?.userId}:${args?.where?.userId_courseId?.courseId}`;
      const entry = enrollments.get(key);
      return entry
        ? { ...entry, course: mockCourses.find((item) => item.id === entry.courseId) }
        : null;
    }),
    upsert: jest.fn(async (args: any) => {
      const userId = args?.where?.userId_courseId?.userId;
      const courseId = args?.where?.userId_courseId?.courseId;
      const key = `${userId}:${courseId}`;
      const existing = enrollments.get(key);
      const next = {
        id: existing?.id || `enrollment-${key}`,
        userId,
        courseId,
        progressScore: existing?.progressScore ?? args?.create?.progressScore ?? 0,
        status: args?.update?.status || args?.create?.status || 'enrolled',
        enrolledAt: existing?.enrolledAt || new Date(),
        updatedAt: new Date(),
      };
      enrollments.set(key, next);
      return { ...next };
    }),
    update: jest.fn(async (args: any) => {
      const userId = args?.where?.userId_courseId?.userId;
      const courseId = args?.where?.userId_courseId?.courseId;
      const key = `${userId}:${courseId}`;
      const existing = enrollments.get(key);
      if (!existing) throw new Error('enrollment not found');
      const next = { ...existing, ...(args?.data || {}), updatedAt: new Date() };
      enrollments.set(key, next);
      return { ...next, course: mockCourses.find((item) => item.id === courseId) };
    }),
  },
};

jest.mock('../services/prismaClient', () => ({
  getPrisma: () => mockDb,
}));

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

const { coursesPublicRoutes, coursesProtectedRoutes } = require('../routes/courses') as typeof import('../routes/courses');
const userCoursesRoutes = require('../routes/userCourses').default as typeof import('../routes/userCourses').default;

let server: http.Server | null = null;
let baseUrl = '';

const requestJson = async (
  path: string,
  options: { method?: string; token?: string; body?: any } = {}
): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

describe('Course catalog public routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'courses-test-secret';
    const app = express();
    app.use(express.json());
    app.use('/api/courses', coursesPublicRoutes);
    app.use('/api/courses', coursesProtectedRoutes);
    app.use('/api/user', userCoursesRoutes);
    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve course test server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    users.clear();
    memberships.clear();
    enrollments.clear();
    mockCourses[0].enrolledCount = 0;
    mockCourses[1].enrolledCount = 0;
  });

  it('returns published courses with rich syllabus metadata and excludes drafts', async () => {
    const response = await requestJson('/api/courses');

    expect(response.status).toBe(200);
    expect(response.body?.courses).toHaveLength(1);
    expect(response.body?.courses?.[0]?.id).toBe('published-course');
    expect(response.body?.courses?.[0]?.fullDescription).toBe('Visible rich course body.');
    expect(response.body?.courses?.[0]?.category).toBe('Launch Readiness');
    expect(response.body?.courses?.[0]?.learningObjectives).toContain('Understand the launch path');
    expect(response.body?.courses?.[0]?.contentSections?.[0]?.title).toBe('Overview');
    expect(JSON.stringify(response.body)).not.toContain('Draft Course');
    expect(response.body?.courses?.[0]?.ownerId).toBeUndefined();
  });

  it('loads published course detail and hides draft detail routes', async () => {
    const published = await requestJson('/api/courses/published-course');
    const draft = await requestJson('/api/courses/draft-course');

    expect(published.status).toBe(200);
    expect(published.body?.course?.id).toBe('published-course');
    expect(draft.status).toBe(404);
  });

  it('requires active membership and tier access for enrollment', async () => {
    users.set('member-1', {
      id: 'member-1',
      role: 'user',
      tier: 'Free / Community Tier',
      membershipStatus: 'active',
    });
    memberships.set('member-1', {
      userId: 'member-1',
      tier: 'Free / Community Tier',
      status: 'active',
    });

    const token = createSessionToken('member-1').token;
    const denied = await requestJson('/api/courses/published-course/enroll', {
      method: 'POST',
      token,
      body: {},
    });
    expect(denied.status).toBe(403);
    expect(denied.body?.error).toContain('Guided Tier');

    memberships.set('member-1', {
      userId: 'member-1',
      tier: 'Guided Tier',
      status: 'active',
    });
    const allowed = await requestJson('/api/courses/published-course/enroll', {
      method: 'POST',
      token,
      body: {},
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body?.course?.id).toBe('published-course');
    expect(allowed.body?.course?.enrolled).toBe(1);
  });

  it('keeps my-courses and progress private to enrolled published courses', async () => {
    users.set('member-2', {
      id: 'member-2',
      role: 'user',
      tier: 'Guided Tier',
      membershipStatus: 'active',
    });
    memberships.set('member-2', {
      userId: 'member-2',
      tier: 'Guided Tier',
      status: 'active',
    });
    enrollments.set('member-2:published-course', {
      id: 'enrollment-member-2',
      userId: 'member-2',
      courseId: 'published-course',
      progressScore: 0,
      status: 'enrolled',
      enrolledAt: new Date(),
      updatedAt: new Date(),
    });
    enrollments.set('member-2:draft-course', {
      id: 'enrollment-draft',
      userId: 'member-2',
      courseId: 'draft-course',
      progressScore: 0,
      status: 'enrolled',
      enrolledAt: new Date(),
      updatedAt: new Date(),
    });
    const token = createSessionToken('member-2').token;

    const list = await requestJson('/api/user/courses', { token });
    expect(list.status).toBe(200);
    expect(list.body?.courses).toHaveLength(1);
    expect(list.body?.courses?.[0]?.id).toBe('published-course');

    const progress = await requestJson('/api/user/courses/published-course/progress', {
      method: 'PATCH',
      token,
      body: { progressScore: 50 },
    });
    expect(progress.status).toBe(200);
    expect(progress.body?.course?.progressScore).toBe(50);
  });
});
