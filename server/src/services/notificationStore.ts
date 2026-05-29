import crypto from 'crypto';
import { getPrisma } from './prismaClient';

export interface PlatformNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  roleScope?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PlatformNotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  roleScope: string | null;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const nullableString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const canUseNotificationPersistence = (): boolean => {
  if (String(process.env.NOTIFICATION_STORE_DISABLED || '').trim().toLowerCase() === 'true') {
    return false;
  }
  if (
    String(process.env.NODE_ENV || '').trim().toLowerCase() === 'test' &&
    String(process.env.ENABLE_NOTIFICATION_STORE_IN_TEST || '').trim().toLowerCase() !== 'true'
  ) {
    return false;
  }
  return true;
};

const toNotificationRecord = (row: any): PlatformNotificationRecord => ({
  id: row.id,
  userId: row.userId,
  type: row.type,
  title: row.title,
  body: row.body,
  roleScope: nullableString(row.roleScope),
  metadata:
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null,
  readAt: row.readAt || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const canSeeNotification = (notification: PlatformNotificationRecord, role: string): boolean => {
  const scope = nullableString(notification.roleScope);
  if (!scope) return true;
  const normalizedRole = String(role || '').trim().toLowerCase();
  return scope
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedRole);
};

export const createNotification = async (
  input: PlatformNotificationInput
): Promise<PlatformNotificationRecord | null> => {
  if (!canUseNotificationPersistence()) return null;
  try {
    const userId = nullableString(input.userId);
    const type = nullableString(input.type);
    const title = nullableString(input.title);
    const body = nullableString(input.body);
    if (!userId || !type || !title || !body) return null;

    const id = crypto.randomUUID();
    const roleScope = nullableString(input.roleScope);
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    const rows = (await (getPrisma() as any).$queryRaw`
      INSERT INTO "Notification" (
        "id", "userId", "type", "title", "body", "roleScope", "metadata", "updatedAt"
      )
      VALUES (
        ${id}, ${userId}, ${type}, ${title}, ${body}, ${roleScope}, CAST(${metadataJson} AS JSONB), CURRENT_TIMESTAMP
      )
      RETURNING "id", "userId", "type", "title", "body", "roleScope", "metadata", "readAt", "createdAt", "updatedAt"
    `) as any[];
    return rows[0] ? toNotificationRecord(rows[0]) : null;
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to create notification', {
      type: input.type,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const listNotificationsForUser = async (input: {
  userId: string;
  role: string;
  limit?: number;
}): Promise<PlatformNotificationRecord[]> => {
  if (!canUseNotificationPersistence()) return [];
  try {
    const userId = nullableString(input.userId);
    if (!userId) return [];
    const limit = Math.min(Math.max(Number(input.limit || 50), 1), 100);
    const rows = (await (getPrisma() as any).$queryRaw`
      SELECT "id", "userId", "type", "title", "body", "roleScope", "metadata", "readAt", "createdAt", "updatedAt"
      FROM "Notification"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `) as any[];
    return rows.map(toNotificationRecord).filter((entry: PlatformNotificationRecord) =>
      canSeeNotification(entry, input.role)
    );
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to list notifications', {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

export const markNotificationRead = async (input: {
  notificationId: string;
  userId: string;
  role?: string;
}): Promise<PlatformNotificationRecord | null> => {
  if (!canUseNotificationPersistence()) return null;
  try {
    const notificationId = nullableString(input.notificationId);
    const userId = nullableString(input.userId);
    if (!notificationId || !userId) return null;

    const rows = (await (getPrisma() as any).$queryRaw`
      UPDATE "Notification"
      SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${notificationId} AND "userId" = ${userId}
      RETURNING "id", "userId", "type", "title", "body", "roleScope", "metadata", "readAt", "createdAt", "updatedAt"
    `) as any[];
    const notification = rows[0] ? toNotificationRecord(rows[0]) : null;
    if (notification && input.role && !canSeeNotification(notification, input.role)) {
      return null;
    }
    return notification;
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to mark notification read', {
      notificationId: input.notificationId,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const markAllNotificationsRead = async (userIdInput: string): Promise<number> => {
  if (!canUseNotificationPersistence()) return 0;
  try {
    const userId = nullableString(userIdInput);
    if (!userId) return 0;
    const updated = await (getPrisma() as any).$executeRaw`
      UPDATE "Notification"
      SET "readAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "readAt" IS NULL
    `;
    return Number(updated || 0);
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to mark notifications read', {
      userId: userIdInput,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};
