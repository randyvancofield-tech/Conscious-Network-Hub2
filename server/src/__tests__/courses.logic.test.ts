import express from 'express';
import http from 'http';

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

const mockDb = {
  course: {
    count: jest.fn(async () => mockCourses.length),
    createMany: jest.fn(async () => ({ count: 0 })),
    findMany: jest.fn(async (args: any) =>
      mockCourses.filter((course) => course.status === args?.where?.status)
    ),
    findUnique: jest.fn(async (args: any) =>
      mockCourses.find((course) => course.id === args?.where?.id) || null
    ),
  },
  userCourse: {
    upsert: jest.fn(),
  },
};

jest.mock('../services/prismaClient', () => ({
  getPrisma: () => mockDb,
}));

const { coursesPublicRoutes } = require('../routes/courses') as typeof import('../routes/courses');

let server: http.Server | null = null;
let baseUrl = '';

const requestJson = async (path: string): Promise<{ status: number; body: any }> => {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

describe('Course catalog public routes', () => {
  beforeAll(async () => {
    const app = express();
    app.use('/api/courses', coursesPublicRoutes);
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
  });
});
