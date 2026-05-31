import { Router, Request, Response } from 'express';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { getPrisma } from '../services/prismaClient';
import { normalizeCourseSyllabusMetadata } from '../services/courseMetadata';
import { hasTierAccess, TIER_VALUES, type TierValue } from '../tierPolicy';

const router = Router();
router.use(requireCanonicalIdentity);

const toUserCourseResponse = (entry: any) => {
  const metadata = normalizeCourseSyllabusMetadata(entry.course.syllabus);
  return {
    id: entry.course.id,
    title: entry.course.title,
    provider: entry.course.provider,
    description: entry.course.description,
    fullDescription: metadata.fullDescription,
    category: metadata.category,
    estimatedDuration: metadata.estimatedDuration,
    learningObjectives: metadata.learningObjectives,
    contentSections: metadata.contentSections,
    image: entry.course.image,
    tier: entry.course.tier,
    enrolled: entry.course.enrolledCount,
    progress: Number(entry.progressScore || 0),
    progressScore: Number(entry.progressScore || 0),
    status: entry.status,
    enrolledAt: entry.enrolledAt,
    updatedAt: entry.updatedAt,
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

const verifyProgressAccess = async (
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
      error: 'Active membership is required to resume courses',
    };
  }

  const requiredTier = courseTierToMembershipTier(course.tier);
  const effectiveTier = membership?.tier || user.tier || null;
  if (!hasTierAccess(effectiveTier, requiredTier)) {
    return {
      allowed: false,
      statusCode: 403,
      error: `Course requires ${requiredTier}`,
    };
  }

  return { allowed: true };
};

router.get('/courses', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const db = getPrisma() as any;
    const enrollments = await db.userCourse.findMany({
      where: { userId, course: { status: 'published' } },
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
    const existing = await db.userCourse.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: true },
    });
    if (!existing || existing.course?.status !== 'published') {
      res.status(404).json({ error: 'Course enrollment not found' });
      return;
    }

    const access = await verifyProgressAccess(userId, existing.course);
    if (!access.allowed) {
      res.status(access.statusCode).json({ error: access.error });
      return;
    }

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
