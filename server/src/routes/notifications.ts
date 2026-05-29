import { Router, Request, Response } from 'express';
import {
  getAuthenticatedRole,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationStore';

const router = Router();

router.use(requireCanonicalIdentity);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const role = getAuthenticatedRole(req);
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
  const notifications = await listNotificationsForUser({ userId, role, limit });
  const unreadCount = notifications.filter((entry) => !entry.readAt).length;

  res.json({
    success: true,
    notifications,
    unreadCount,
  });
});

router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const id = String(req.params.id || '').trim();
  const role = getAuthenticatedRole(req);
  const notification = await markNotificationRead({ notificationId: id, userId, role });
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  res.json({
    success: true,
    notification,
  });
});

router.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const updated = await markAllNotificationsRead(userId);
  res.json({
    success: true,
    updated,
  });
});

export default router;
