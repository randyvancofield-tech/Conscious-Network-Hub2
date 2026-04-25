import { Router, Request, Response } from 'express';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { getPrisma } from '../services/prismaClient';
import { defaultCourses } from '../data/defaultCourses';

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

const toCourseResponse = (course: any, enrollment?: any) => ({
  id: course.id,
  ownerId: course.ownerId,
  ownerType: course.ownerType,
  title: course.title,
  provider: course.provider,
  description: course.description,
  image: course.image,
  tier: course.tier,
  enrolled: course.enrolledCount,
  status: course.status,
  progressScore: enrollment ? Number(enrollment.progressScore || 0) : null,
  enrollmentStatus: enrollment?.status || null,
});

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

protectedRouter.use(requireCanonicalIdentity);

protectedRouter.post('/:id/enroll', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
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

    const enrollment = await db.userCourse.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { status: 'enrolled' },
      create: { userId, courseId, progressScore: 0, status: 'enrolled' },
    });

    res.json({ success: true, course: toCourseResponse(course, enrollment) });
  } catch (error) {
    console.error('[COURSES][ERROR] Failed to enroll course', error);
    res.status(500).json({ error: 'Failed to enroll course' });
  }
});

export { publicRouter as coursesPublicRoutes, protectedRouter as coursesProtectedRoutes };
