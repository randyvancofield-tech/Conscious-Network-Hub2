import { Router, Request, Response } from 'express';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { getPrisma } from '../services/prismaClient';

const router = Router();
router.use(requireCanonicalIdentity);

const toUserCourseResponse = (entry: any) => ({
  id: entry.course.id,
  title: entry.course.title,
  provider: entry.course.provider,
  description: entry.course.description,
  image: entry.course.image,
  tier: entry.course.tier,
  enrolled: entry.course.enrolledCount,
  progress: Number(entry.progressScore || 0),
  progressScore: Number(entry.progressScore || 0),
  status: entry.status,
  enrolledAt: entry.enrolledAt,
  updatedAt: entry.updatedAt,
});

router.get('/courses', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const db = getPrisma() as any;
    const enrollments = await db.userCourse.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, courses: enrollments.map(toUserCourseResponse) });
  } catch (error) {
    console.error('[USER_COURSES][ERROR] Failed to list user courses', error);
    res.status(500).json({ error: 'Failed to list user courses' });
  }
});

router.patch('/courses/:id/progress', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const courseId = String(req.params.id || '').trim();
  const rawScore = Number(req.body?.progressScore ?? req.body?.progress);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!Number.isFinite(rawScore)) {
    res.status(400).json({ error: 'progressScore must be a number' });
    return;
  }

  const progressScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  try {
    const db = getPrisma() as any;
    const updated = await db.userCourse.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        progressScore,
        status: progressScore >= 100 ? 'completed' : 'enrolled',
      },
      include: { course: true },
    });
    res.json({ success: true, course: toUserCourseResponse(updated) });
  } catch (error) {
    console.error('[USER_COURSES][ERROR] Failed to update course progress', error);
    res.status(404).json({ error: 'Course enrollment not found' });
  }
});

export default router;
