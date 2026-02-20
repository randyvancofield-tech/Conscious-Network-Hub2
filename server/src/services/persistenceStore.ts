import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  localStore as fileStore,
  type LocalMembershipRecord,
  type LocalPaymentRecord,
  type LocalProviderChallengeRecord,
  type LocalProviderSessionRecord,
  type LocalReflectionRecord,
  type LocalStoreDiagnostics,
  type LocalUserRecord,
  type TwoFactorMethod,
  type UserProfileMedia,
} from './localStore';

type StoreApi = typeof fileStore;
type CreateUserInput = Parameters<StoreApi['createUser']>[0];
type UpdateUserInput = Parameters<StoreApi['updateUser']>[1];
type UpsertMembershipInput = Parameters<StoreApi['upsertMembership']>[0];
type CreatePaymentInput = Parameters<StoreApi['createPayment']>[0];
type CreateReflectionInput = Parameters<StoreApi['createReflection']>[0];
type CreateProviderChallengeInput = Parameters<StoreApi['createProviderChallenge']>[0];
type CreateProviderSessionInput = Parameters<StoreApi['createProviderSession']>[0];

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const backendOverride = String(process.env.AUTH_PERSISTENCE_BACKEND || '')
  .trim()
  .toLowerCase();
const urlSuggestsSharedDb = /^postgres(?:ql)?:\/\//i.test(databaseUrl);

export const isUsingSharedPersistence =
  backendOverride === 'shared_db' ||
  (backendOverride !== 'local_file' && urlSuggestsSharedDb);

const prisma = isUsingSharedPersistence ? new PrismaClient() : null;

const storeUnavailableError = (message: string, cause?: unknown): Error & { code: string } => {
  const error = new Error(message) as Error & { code: string; cause?: unknown };
  error.code = 'STORE_UNAVAILABLE';
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

const toNullableString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeInterests = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
};

const normalizePrivacySettings = (
  value: unknown
): { profileVisibility: 'public' | 'private'; showEmail: boolean; allowMessages: boolean; blockedUsers: string[] } => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const visibility =
    String(input.profileVisibility || '').trim().toLowerCase() === 'private'
      ? 'private'
      : 'public';
  const blockedUsers = Array.isArray(input.blockedUsers)
    ? input.blockedUsers
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 500)
    : [];
  return {
    profileVisibility: visibility,
    showEmail: Boolean(input.showEmail),
    allowMessages: input.allowMessages === undefined ? true : Boolean(input.allowMessages),
    blockedUsers: [...new Set(blockedUsers)],
  };
};

const normalizeUserMediaAsset = (
  value: unknown,
  fallbackUrl: string | null
): { url: string | null; storageProvider: string | null; objectKey: string | null } => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawUrl = String(input.url ?? '').trim();
  const rawStorageProvider = String(input.storageProvider ?? '').trim();
  const rawObjectKey = String(input.objectKey ?? '').trim();
  return {
    url: rawUrl || fallbackUrl || null,
    storageProvider: rawStorageProvider || null,
    objectKey: rawObjectKey || null,
  };
};

const normalizeProfileMedia = (
  value: unknown,
  avatarFallback: string | null,
  coverFallback: string | null
): UserProfileMedia => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    avatar: normalizeUserMediaAsset(input.avatar, avatarFallback),
    cover: normalizeUserMediaAsset(input.cover, coverFallback),
  };
};

const readJsonObject = (value: Prisma.JsonValue | null): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const readJsonStringArray = (value: Prisma.JsonValue | null): string[] => {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
};

const toLocalUser = (row: any): LocalUserRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  handle: toNullableString(row.handle),
  bio: toNullableString(row.bio),
  location: toNullableString(row.location),
  dateOfBirth: row.dateOfBirth || null,
  avatarUrl: toNullableString(row.avatarUrl),
  bannerUrl: toNullableString(row.bannerUrl),
  profileMedia: normalizeProfileMedia(
    readJsonObject(row.profileMedia ?? null),
    toNullableString(row.avatarUrl),
    toNullableString(row.bannerUrl)
  ),
  interests: normalizeInterests(readJsonStringArray(row.interests ?? null)),
  twitterUrl: toNullableString(row.twitterUrl),
  githubUrl: toNullableString(row.githubUrl),
  websiteUrl: toNullableString(row.websiteUrl),
  privacySettings: normalizePrivacySettings(readJsonObject(row.privacySettings ?? null)),
  password: row.password,
  passwordFingerprint: toNullableString(row.passwordFingerprint),
  tier: row.tier,
  subscriptionStatus: row.subscriptionStatus,
  subscriptionStartDate: row.subscriptionStartDate || null,
  subscriptionEndDate: row.subscriptionEndDate || null,
  profileBackgroundVideo: toNullableString(row.profileBackgroundVideo),
  phoneNumber: toNullableString(row.phoneNumber),
  twoFactorMethod: (row.twoFactorMethod || 'none') as TwoFactorMethod,
  walletDid: toNullableString(row.walletDid),
  pendingPhoneOtpHash: toNullableString(row.pendingPhoneOtpHash),
  pendingPhoneOtpExpiresAt: row.pendingPhoneOtpExpiresAt || null,
  pendingPhoneOtpAttempts: Number(row.pendingPhoneOtpAttempts || 0),
  failedSignInAttempts: Number(row.failedSignInAttempts || 0),
  lockoutUntil: row.lockoutUntil || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toLocalMembership = (row: any): LocalMembershipRecord => ({
  id: row.id,
  userId: row.userId,
  tier: row.tier,
  status: row.status,
  startDate: row.startDate,
  endDate: row.endDate || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toLocalPayment = (row: any): LocalPaymentRecord => ({
  id: row.id,
  userId: row.userId,
  membershipId: row.membershipId,
  amount: Number(row.amount),
  currency: row.currency,
  tier: row.tier,
  status: row.status,
  paymentMethod: row.paymentMethod,
  description: toNullableString(row.description),
  createdAt: row.createdAt,
});

const toLocalReflection = (row: any): LocalReflectionRecord => ({
  id: row.id,
  userId: row.userId,
  content: toNullableString(row.content),
  fileUrl: row.fileUrl,
  fileType: row.fileType,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toLocalProviderChallenge = (row: any): LocalProviderChallengeRecord => ({
  id: row.id,
  did: row.did,
  nonce: row.nonce,
  statement: row.statement,
  expiresAt: row.expiresAt,
  usedAt: row.usedAt || null,
  createdAt: row.createdAt,
});

const toLocalProviderSession = (row: any): LocalProviderSessionRecord => ({
  id: row.id,
  did: row.did,
  scopes: (() => {
    try {
      return JSON.parse(row.scopesJson || '[]');
    } catch {
      return [];
    }
  })(),
  issuedAt: row.issuedAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt || null,
  createdAt: row.createdAt,
});

const ensurePrisma = (): PrismaClient => {
  if (!prisma) {
    throw storeUnavailableError(
      '[STORE][FATAL] Shared database store is not initialized. Set DATABASE_URL to postgres://... or postgresql://...'
    );
  }
  return prisma;
};

const translatePrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const duplicateError = new Error('Duplicate email') as Error & { code: string };
      duplicateError.code = 'DUPLICATE_USER';
      throw duplicateError;
    }
    if (error.code === 'P2025') {
      throw storeUnavailableError('[STORE][FATAL] Record not found during shared DB operation', error);
    }
  }

  throw storeUnavailableError('[STORE][FATAL] Shared DB persistence operation failed', error);
};

export const localStore = {
  async getStoreFilePath(): Promise<string> {
    if (!isUsingSharedPersistence) {
      return fileStore.getStoreFilePath();
    }
    return 'shared-db://database-url';
  },

  async getUserByEmail(email: string): Promise<LocalUserRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.getUserByEmail(email);
    }

    try {
      const row = await ensurePrisma().user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      return row ? toLocalUser(row) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async getUserById(id: string): Promise<LocalUserRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.getUserById(id);
    }

    try {
      const row = await ensurePrisma().user.findUnique({ where: { id } });
      return row ? toLocalUser(row) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async listUsers(limit = 250): Promise<LocalUserRecord[]> {
    if (!isUsingSharedPersistence) {
      return fileStore.listUsers(limit);
    }

    try {
      const rows = await ensurePrisma().user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map(toLocalUser);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async findUserByPasswordFingerprint(passwordFingerprint: string): Promise<LocalUserRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.findUserByPasswordFingerprint(passwordFingerprint);
    }

    try {
      const row = await ensurePrisma().user.findFirst({
        where: {
          passwordFingerprint,
        },
      });
      return row ? toLocalUser(row) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async createUser(input: CreateUserInput): Promise<LocalUserRecord> {
    if (!isUsingSharedPersistence) {
      return fileStore.createUser(input);
    }

    try {
      const row = await ensurePrisma().user.create({
        data: {
          id: crypto.randomUUID(),
          email: input.email.trim().toLowerCase(),
          name: toNullableString(input.name),
          handle: toNullableString(input.handle),
          bio: toNullableString(input.bio),
          location: toNullableString(input.location),
          dateOfBirth: input.dateOfBirth || null,
          avatarUrl: toNullableString(input.avatarUrl),
          bannerUrl: toNullableString(input.bannerUrl),
          profileMedia: normalizeProfileMedia(
            input.profileMedia,
            toNullableString(input.avatarUrl),
            toNullableString(input.bannerUrl)
          ),
          interests: [],
          twitterUrl: null,
          githubUrl: null,
          websiteUrl: null,
          privacySettings: normalizePrivacySettings(undefined),
          password: input.password,
          passwordFingerprint: toNullableString(input.passwordFingerprint),
          tier: input.tier,
          subscriptionStatus: 'inactive',
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          profileBackgroundVideo: null,
          phoneNumber: toNullableString(input.phoneNumber),
          twoFactorMethod: input.twoFactorMethod || 'none',
          walletDid: toNullableString(input.walletDid),
          pendingPhoneOtpHash: null,
          pendingPhoneOtpExpiresAt: null,
          pendingPhoneOtpAttempts: 0,
          failedSignInAttempts: 0,
          lockoutUntil: null,
        } as any,
      });
      return toLocalUser(row);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async updateUser(id: string, updates: UpdateUserInput): Promise<LocalUserRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.updateUser(id, updates);
    }

    try {
      const db = ensurePrisma();
      const data: Record<string, unknown> = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.handle !== undefined) data.handle = updates.handle;
      if (updates.bio !== undefined) data.bio = updates.bio;
      if (updates.location !== undefined) data.location = updates.location;
      if (updates.dateOfBirth !== undefined) data.dateOfBirth = updates.dateOfBirth;

      const needsMediaRebuild =
        updates.profileMedia !== undefined ||
        updates.avatarUrl !== undefined ||
        updates.bannerUrl !== undefined;
      let existingMediaRow: any | null = null;
      if (needsMediaRebuild) {
        existingMediaRow = await db.user.findUnique({ where: { id } });
        if (!existingMediaRow) {
          return null;
        }
      }

      const currentAvatarUrl = toNullableString(existingMediaRow?.avatarUrl);
      const currentBannerUrl = toNullableString(existingMediaRow?.bannerUrl);
      const nextAvatarUrl =
        updates.avatarUrl !== undefined ? toNullableString(updates.avatarUrl) : currentAvatarUrl;
      const nextBannerUrl =
        updates.bannerUrl !== undefined ? toNullableString(updates.bannerUrl) : currentBannerUrl;

      if (updates.avatarUrl !== undefined) data.avatarUrl = nextAvatarUrl;
      if (updates.bannerUrl !== undefined) data.bannerUrl = nextBannerUrl;
      if (updates.profileMedia !== undefined) {
        data.profileMedia = normalizeProfileMedia(
          updates.profileMedia,
          nextAvatarUrl,
          nextBannerUrl
        );
      } else if (updates.avatarUrl !== undefined || updates.bannerUrl !== undefined) {
        data.profileMedia = normalizeProfileMedia(
          readJsonObject(existingMediaRow?.profileMedia ?? null),
          nextAvatarUrl,
          nextBannerUrl
        );
      }

      if (updates.interests !== undefined) data.interests = normalizeInterests(updates.interests);
      if (updates.twitterUrl !== undefined) data.twitterUrl = updates.twitterUrl;
      if (updates.githubUrl !== undefined) data.githubUrl = updates.githubUrl;
      if (updates.websiteUrl !== undefined) data.websiteUrl = updates.websiteUrl;
      if (updates.privacySettings !== undefined) {
        data.privacySettings = normalizePrivacySettings(updates.privacySettings);
      }
      if (updates.password !== undefined) data.password = updates.password;
      if (updates.passwordFingerprint !== undefined) {
        data.passwordFingerprint = updates.passwordFingerprint;
      }
      if (updates.tier !== undefined) data.tier = updates.tier;
      if (updates.subscriptionStatus !== undefined) data.subscriptionStatus = updates.subscriptionStatus;
      if (updates.subscriptionStartDate !== undefined) {
        data.subscriptionStartDate = updates.subscriptionStartDate;
      }
      if (updates.subscriptionEndDate !== undefined) data.subscriptionEndDate = updates.subscriptionEndDate;
      if (updates.profileBackgroundVideo !== undefined) {
        data.profileBackgroundVideo = updates.profileBackgroundVideo;
      }
      if (updates.phoneNumber !== undefined) data.phoneNumber = updates.phoneNumber;
      if (updates.twoFactorMethod !== undefined) data.twoFactorMethod = updates.twoFactorMethod;
      if (updates.walletDid !== undefined) data.walletDid = updates.walletDid;
      if (updates.pendingPhoneOtpHash !== undefined) {
        data.pendingPhoneOtpHash = updates.pendingPhoneOtpHash;
      }
      if (updates.pendingPhoneOtpExpiresAt !== undefined) {
        data.pendingPhoneOtpExpiresAt = updates.pendingPhoneOtpExpiresAt;
      }
      if (updates.pendingPhoneOtpAttempts !== undefined) {
        data.pendingPhoneOtpAttempts = updates.pendingPhoneOtpAttempts;
      }
      if (updates.failedSignInAttempts !== undefined) {
        data.failedSignInAttempts = updates.failedSignInAttempts;
      }
      if (updates.lockoutUntil !== undefined) data.lockoutUntil = updates.lockoutUntil;

      const row = await db.user.update({
        where: { id },
        data: data as any,
      });
      return toLocalUser(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      return translatePrismaError(error);
    }
  },

  async upsertMembership(input: UpsertMembershipInput): Promise<LocalMembershipRecord> {
    if (!isUsingSharedPersistence) {
      return fileStore.upsertMembership(input);
    }

    try {
      const row = await ensurePrisma().membership.upsert({
        where: { userId: input.userId },
        update: {
          tier: input.tier,
          status: input.status,
          startDate: input.startDate || new Date(),
        },
        create: {
          id: crypto.randomUUID(),
          userId: input.userId,
          tier: input.tier,
          status: input.status,
          startDate: input.startDate || new Date(),
        },
      });
      return toLocalMembership(row);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async getMembershipByUserId(userId: string): Promise<LocalMembershipRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.getMembershipByUserId(userId);
    }

    try {
      const row = await ensurePrisma().membership.findUnique({ where: { userId } });
      return row ? toLocalMembership(row) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async listMembershipsByUserId(userId: string, limit = 1): Promise<LocalMembershipRecord[]> {
    if (!isUsingSharedPersistence) {
      return fileStore.listMembershipsByUserId(userId, limit);
    }

    try {
      const rows = await ensurePrisma().membership.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map(toLocalMembership);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async createPayment(input: CreatePaymentInput): Promise<LocalPaymentRecord> {
    if (!isUsingSharedPersistence) {
      return fileStore.createPayment(input);
    }

    try {
      const row = await ensurePrisma().paymentHistory.create({
        data: {
          id: crypto.randomUUID(),
          userId: input.userId,
          membershipId: input.membershipId,
          amount: input.amount,
          currency: input.currency || 'USD',
          tier: input.tier,
          status: input.status || 'completed',
          paymentMethod: input.paymentMethod || 'mock',
          description: input.description || null,
        },
      });
      return toLocalPayment(row);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async listPaymentsByUserId(userId: string, limit = 5): Promise<LocalPaymentRecord[]> {
    if (!isUsingSharedPersistence) {
      return fileStore.listPaymentsByUserId(userId, limit);
    }

    try {
      const rows = await ensurePrisma().paymentHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map(toLocalPayment);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async createReflection(input: CreateReflectionInput): Promise<LocalReflectionRecord> {
    if (!isUsingSharedPersistence) {
      return fileStore.createReflection(input);
    }

    try {
      const row = await ensurePrisma().reflection.create({
        data: {
          id: crypto.randomUUID(),
          userId: input.userId,
          content: input.content || null,
          fileUrl: input.fileUrl,
          fileType: input.fileType,
        },
      });
      return toLocalReflection(row);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async listReflectionsByUserId(userId: string): Promise<LocalReflectionRecord[]> {
    if (!isUsingSharedPersistence) {
      return fileStore.listReflectionsByUserId(userId);
    }

    try {
      const rows = await ensurePrisma().reflection.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(toLocalReflection);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async createProviderChallenge(
    input: CreateProviderChallengeInput
  ): Promise<LocalProviderChallengeRecord> {
    if (!isUsingSharedPersistence) {
      return fileStore.createProviderChallenge(input);
    }

    try {
      const row = await ensurePrisma().providerChallenge.upsert({
        where: { id: input.id },
        update: {
          did: input.did,
          nonce: input.nonce,
          statement: input.statement,
          expiresAt: input.expiresAt,
          usedAt: null,
          createdAt: input.createdAt || new Date(),
        },
        create: {
          id: input.id,
          did: input.did,
          nonce: input.nonce,
          statement: input.statement,
          expiresAt: input.expiresAt,
          usedAt: null,
          createdAt: input.createdAt || new Date(),
        },
      });
      return toLocalProviderChallenge(row);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async getProviderChallengeById(id: string): Promise<LocalProviderChallengeRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.getProviderChallengeById(id);
    }

    try {
      const row = await ensurePrisma().providerChallenge.findUnique({ where: { id } });
      return row ? toLocalProviderChallenge(row) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async markProviderChallengeUsed(id: string): Promise<void> {
    if (!isUsingSharedPersistence) {
      fileStore.markProviderChallengeUsed(id);
      return;
    }

    try {
      const challenge = await ensurePrisma().providerChallenge.findUnique({ where: { id } });
      if (!challenge || challenge.usedAt) return;
      await ensurePrisma().providerChallenge.update({
        where: { id },
        data: { usedAt: new Date() },
      });
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async createProviderSession(input: CreateProviderSessionInput): Promise<LocalProviderSessionRecord> {
    if (!isUsingSharedPersistence) {
      return fileStore.createProviderSession(input);
    }

    try {
      const row = await ensurePrisma().providerSession.upsert({
        where: { id: input.id },
        update: {
          did: input.did,
          scopesJson: JSON.stringify(input.scopes),
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          revokedAt: null,
          createdAt: input.createdAt || new Date(),
        },
        create: {
          id: input.id,
          did: input.did,
          scopesJson: JSON.stringify(input.scopes),
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          revokedAt: null,
          createdAt: input.createdAt || new Date(),
        },
      });
      return toLocalProviderSession(row);
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async getProviderSessionById(id: string): Promise<LocalProviderSessionRecord | null> {
    if (!isUsingSharedPersistence) {
      return fileStore.getProviderSessionById(id);
    }

    try {
      const row = await ensurePrisma().providerSession.findUnique({ where: { id } });
      return row ? toLocalProviderSession(row) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async revokeProviderSession(id: string): Promise<void> {
    if (!isUsingSharedPersistence) {
      fileStore.revokeProviderSession(id);
      return;
    }

    try {
      const session = await ensurePrisma().providerSession.findUnique({ where: { id } });
      if (!session || session.revokedAt) return;
      await ensurePrisma().providerSession.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      return translatePrismaError(error);
    }
  },

  async getDiagnostics(): Promise<LocalStoreDiagnostics> {
    if (!isUsingSharedPersistence) {
      return fileStore.getDiagnostics();
    }

    try {
      const db = ensurePrisma();
      const [
        users,
        memberships,
        payments,
        reflections,
        providerChallenges,
        providerSessions,
      ] = await db.$transaction([
        db.user.count(),
        db.membership.count(),
        db.paymentHistory.count(),
        db.reflection.count(),
        db.providerChallenge.count(),
        db.providerSession.count(),
      ]);

      return {
        generatedAt: new Date().toISOString(),
        files: {
          primary: {
            path: 'shared-db://primary',
            exists: true,
            readable: true,
            jsonValid: null,
            sizeBytes: null,
            modifiedAt: null,
            error: null,
          },
          backup: {
            path: 'shared-db://backup-not-applicable',
            exists: false,
            readable: false,
            jsonValid: null,
            sizeBytes: null,
            modifiedAt: null,
            error: null,
          },
          temp: {
            path: 'shared-db://temp-not-applicable',
            exists: false,
            readable: false,
            jsonValid: null,
            sizeBytes: null,
            modifiedAt: null,
            error: null,
          },
        },
        lastRecoveryStatus: {
          state: 'healthy',
          at: new Date().toISOString(),
          detail: 'Using shared DB-backed persistence store',
        },
        activeStore: {
          source: 'primary',
          users,
          memberships,
          payments,
          reflections,
          providerChallenges,
          providerSessions,
        },
      };
    } catch (error) {
      return translatePrismaError(error);
    }
  },
};

export type {
  LocalMembershipRecord,
  LocalPaymentRecord,
  LocalProviderChallengeRecord,
  LocalProviderSessionRecord,
  LocalReflectionRecord,
  LocalStoreDiagnostics,
  LocalUserRecord,
  TwoFactorMethod,
};
