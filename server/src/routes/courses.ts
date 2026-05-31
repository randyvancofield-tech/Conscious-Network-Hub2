import { Router, Request, Response } from 'express';
import { getAuthenticatedRole, getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { getPrisma } from '../services/prismaClient';
import { defaultCourses } from '../data/defaultCourses';
import { normalizeCourseSyllabusMetadata } from '../services/courseMetadata';
import { hasTierAccess, TIER_VALUES, type TierValue } from '../tierPolicy';

const publicRouter = Router();
const protectedRouter = Router();

const ensureDefaultCourses = async (): Promise<void> => {
  const db = getPrisma() as any;
  const count = await db.course.count();
  if (count > 0) return;

  await db.course.createMany({
    data: defaultCourses.map((course) => ({
      ...course,
      status: 'published',
    })),
    skipDuplicates: true,
  });
};

const toCourseResponse = (course: any, enrollment?: any) => {
  const metadata = normalizeCourseSyllabusMetadata(course.syllabus);
  return {
    id: course.id,
    title: course.title,
    provider: course.provider,
    description: course.description,
    fullDescription: metadata.fullDescription,
    category: metadata.category,
    estimatedDuration: metadata.estimatedDuration,
    learningObjectives: metadata.learningObjectives,
    contentSections: metadata.contentSections,
    image: course.image,
    tier: course.tier,
    enrolled: course.enrolledCount,
    status: course.status,
    progressScore: enrollment ? Number(enrollment.progressScore || 0) : null,
    enrollmentStatus: enrollment?.status || null,
  };
};

const courseTierToMembershipTier = (courseTier: unknown): TierValue => {
  const normalized = String(courseTier || '').trim().toLowerCase();
  if (normalized === 'elite' || normalized === 'accelerated tier') return TIER_VALUES.ACCELERATED;
  if (normalized === 'professional' || normalized === 'guided tier') return TIER_VALUES.GUIDED;
  return TIER_VALUES.FREE;
};

const isActiveMembershipStatus = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'active' || normalized === 'trialing';
};

const syncCourseEnrollmentCount = async (courseId: string): Promise<number> => {
  const db = getPrisma() as any;
  const enrolledCount = await db.userCourse.count({
    where: {
      courseId,
      status: { in: ['enrolled', 'completed'] },
    },
  });
  await db.course.update({
    where: { id: courseId },
    data: { enrolledCount },
  });
  return enrolledCount;
};

const verifyEnrollmentAccess = async (
  userId: string,
  course: any
): Promise<{ allowed: true } | { allowed: false; statusCode: number; error: string }> => {
  const db = getPrisma() as any;
  const [user, membership] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { role: true, tier: true, membershipStatus: true },
    }),
    db.membership.findUnique({ where: { userId } }),
  ]);
  if (!user) return { allowed: false, statusCode: 401, error: 'Authentication required' };

  const hasActiveMembership =
    isActiveMembershipStatus(membership?.status) || isActiveMembershipStatus(user.membershipStatus);
  if (!hasActiveMembership && user.role !== 'admin') {
    return {
      allowed: false,
      statusCode: 403,
      error: 'Active membership is required to enroll in courses',
    };
  }

  const effectiveTier = membership?.tier || user.tier || null;
  const requiredTier = courseTierToMembershipTier(course.tier);
  if (!hasTierAccess(effectiveTier, requiredTier)) {
    return {
      allowed: false,
      statusCode: 403,
      error: `Course requires ${requiredTier}`,
    };
  }

  return { allowed: true };
};

publicRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureDefaultCourses();
    const db = getPrisma() as any;
    const courses = await db.course.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, courses: courses.map((course: any) => toCourseResponse(course)) });
  } catch (error) {
    console.error('[COURSES][ERROR] Failed to list courses', error);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

publicRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const courseId = String(req.params.id || '').trim();
  if (!courseId) {
    res.status(400).json({ error: 'Course id is required' });
    return;
  }

  try {
    await ensureDefaultCourses();
    const db = getPrisma() as any;
    const course = await db.course.findFirst({
      where: { id: courseId, status: 'published' },
    });
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    res.json({ success: true, course: toCourseResponse(course) });
  } catch (error) {
    console.error('[COURSES][ERROR] Failed to load course detail', error);
    res.status(500).json({ error: 'Failed to load course detail' });
  }
});

protectedRouter.use(requireCanonicalIdentity);

protectedRouter.post('/:id/enroll', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const role = getAuthenticatedRole(req);
  const courseId = String(req.params.id || '').trim();
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    await ensureDefaultCourses();
    const db = getPrisma() as any;
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== 'published') {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const access = await verifyEnrollmentAccess(userId, course);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.error });
      return;
    }

    const enrollment = await db.userCourse.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { status: 'enrolled' },
      create: { userId, courseId, progressScore: 0, status: 'enrolled' },
    });
    const enrolledCount = await syncCourseEnrollmentCount(courseId);

    res.json({
      success: true,
      course: toCourseResponse({ ...course, enrolledCount }, enrollment),
      role,
    });
  } catch (error) {
    console.error('[COURSES][ERROR] Failed to enroll course', error);
    res.status(500).json({ error: 'Failed to enroll course' });
  }
});

export { publicRouter as coursesPublicRoutes, protectedRouter as coursesProtectedRoutes };
