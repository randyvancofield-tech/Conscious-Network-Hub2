import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  protectSensitiveField,
  revealSensitiveField,
} from './sensitiveDataPolicy';

export type TwoFactorMethod = 'none' | 'phone' | 'wallet';

type NullableIso = string | null;

interface UserPrivacySettings {
  profileVisibility: 'public' | 'private';
  showEmail: boolean;
  allowMessages: boolean;
  blockedUsers: string[];
}

interface UserMediaAsset {
  url: string | null;
  storageProvider: string | null;
  objectKey: string | null;
}

export interface UserProfileMedia {
  avatar: UserMediaAsset;
  cover: UserMediaAsset;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  location: string | null;
  dateOfBirth: NullableIso;
  avatarUrl: string | null;
  bannerUrl: string | null;
  profileMedia: UserProfileMedia;
  interests: string[];
  twitterUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  privacySettings: UserPrivacySettings;
  password: string;
  passwordFingerprint: string | null;
  tier: string;
  subscriptionStatus: string;
  subscriptionStartDate: NullableIso;
  subscriptionEndDate: NullableIso;
  profileBackgroundVideo: string | null;
  phoneNumber: string | null;
  twoFactorMethod: TwoFactorMethod;
  walletDid: string | null;
  pendingPhoneOtpHash: string | null;
  pendingPhoneOtpExpiresAt: NullableIso;
  pendingPhoneOtpAttempts: number;
  failedSignInAttempts: number;
  lockoutUntil: NullableIso;
  createdAt: string;
  updatedAt: string;
}

interface MembershipRow {
  id: string;
  userId: string;
  tier: string;
  status: string;
  startDate: string;
  endDate: NullableIso;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRow {
  id: string;
  userId: string;
  membershipId: string;
  amount: number;
  currency: string;
  tier: string;
  status: string;
  paymentMethod: string;
  description: string | null;
  createdAt: string;
}

interface ReflectionRow {
  id: string;
  userId: string;
  content: string | null;
  fileUrl: string;
  fileType: string;
  createdAt: string;
  updatedAt: string;
}

interface ProviderChallengeRow {
  id: string;
  did: string;
  nonce: string;
  statement: string;
  expiresAt: string;
  usedAt: NullableIso;
  createdAt: string;
}

interface ProviderSessionRow {
  id: string;
  did: string;
  scopesJson: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: NullableIso;
  createdAt: string;
}

interface StoreRow {
  version: number;
  users: UserRow[];
  memberships: MembershipRow[];
  payments: PaymentRow[];
  reflections: ReflectionRow[];
  providerChallenges: ProviderChallengeRow[];
  providerSessions: ProviderSessionRow[];
}

type RecoveryState =
  | 'not_checked'
  | 'healthy'
  | 'initialized_empty'
  | 'initialized_from_tmp'
  | 'initialized_from_backup'
  | 'recovered_from_backup'
  | 'store_unreadable'
  | 'save_failed';

interface RecoveryStatus {
  state: RecoveryState;
  at: string;
  detail: string;
}

interface StoreFileHealth {
  path: string;
  exists: boolean;
  readable: boolean;
  jsonValid: boolean | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  error: string | null;
}

export interface LocalStoreDiagnostics {
  generatedAt: string;
  files: {
    primary: StoreFileHealth;
    backup: StoreFileHealth;
    temp: StoreFileHealth;
  };
  lastRecoveryStatus: RecoveryStatus;
  activeStore: {
    source: 'primary' | 'backup' | 'none';
    users: number;
    memberships: number;
    payments: number;
    reflections: number;
    providerChallenges: number;
    providerSessions: number;
  };
}

export interface LocalUserRecord {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  location: string | null;
  dateOfBirth: Date | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  profileMedia: UserProfileMedia;
  interests: string[];
  twitterUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  privacySettings: UserPrivacySettings;
  password: string;
  passwordFingerprint: string | null;
  tier: string;
  subscriptionStatus: string;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  profileBackgroundVideo: string | null;
  phoneNumber: string | null;
  twoFactorMethod: TwoFactorMethod;
  walletDid: string | null;
  pendingPhoneOtpHash: string | null;
  pendingPhoneOtpExpiresAt: Date | null;
  pendingPhoneOtpAttempts: number;
  failedSignInAttempts: number;
  lockoutUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalMembershipRecord {
  id: string;
  userId: string;
  tier: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalPaymentRecord {
  id: string;
  userId: string;
  membershipId: string;
  amount: number;
  currency: string;
  tier: string;
  status: string;
  paymentMethod: string;
  description: string | null;
  createdAt: Date;
}

export interface LocalReflectionRecord {
  id: string;
  userId: string;
  content: string | null;
  fileUrl: string;
  fileType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalProviderChallengeRecord {
  id: string;
  did: string;
  nonce: string;
  statement: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface LocalProviderSessionRecord {
  id: string;
  did: string;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

interface CreateUserInput {
  email: string;
  name: string;
  handle?: string | null;
  bio?: string | null;
  location?: string | null;
  dateOfBirth?: Date | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileMedia?: UserProfileMedia;
  interests?: string[];
  twitterUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  privacySettings?: UserPrivacySettings;
  password: string;
  passwordFingerprint?: string | null;
  tier: string;
  phoneNumber?: string | null;
  twoFactorMethod?: TwoFactorMethod;
  walletDid?: string | null;
}

interface UpdateUserInput {
  name?: string | null;
  handle?: string | null;
  bio?: string | null;
  location?: string | null;
  dateOfBirth?: Date | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileMedia?: UserProfileMedia;
  interests?: string[];
  twitterUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  privacySettings?: UserPrivacySettings;
  password?: string;
  passwordFingerprint?: string | null;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: Date | null;
  subscriptionEndDate?: Date | null;
  profileBackgroundVideo?: string | null;
  phoneNumber?: string | null;
  twoFactorMethod?: TwoFactorMethod;
  walletDid?: string | null;
  pendingPhoneOtpHash?: string | null;
  pendingPhoneOtpExpiresAt?: Date | null;
  pendingPhoneOtpAttempts?: number;
  failedSignInAttempts?: number;
  lockoutUntil?: Date | null;
}

interface UpsertMembershipInput {
  userId: string;
  tier: string;
  status: string;
  startDate?: Date;
}

interface CreatePaymentInput {
  userId: string;
  membershipId: string;
  amount: number;
  currency?: string;
  tier: string;
  status?: string;
  paymentMethod?: string;
  description?: string | null;
}

interface CreateReflectionInput {
  userId: string;
  content?: string | null;
  fileUrl: string;
  fileType: string;
}

interface CreateProviderChallengeInput {
  id: string;
  did: string;
  nonce: string;
  statement: string;
  expiresAt: Date;
  createdAt?: Date;
}

interface CreateProviderSessionInput {
  id: string;
  did: string;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
  createdAt?: Date;
}

const STORE_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(STORE_DIR, 'runtime-store.json');
const STORE_BACKUP_FILE = path.join(STORE_DIR, 'runtime-store.backup.json');
const STORE_TMP_FILE = path.join(STORE_DIR, 'runtime-store.tmp.json');
export const LOCAL_STORE_FILE = STORE_FILE;

let lastRecoveryStatus: RecoveryStatus = {
  state: 'not_checked',
  at: new Date().toISOString(),
  detail: 'No store operations have run yet.',
};

const setRecoveryStatus = (state: RecoveryState, detail: string): void => {
  lastRecoveryStatus = {
    state,
    at: new Date().toISOString(),
    detail,
  };
};

const toStoreError = (message: string, cause?: unknown): Error & { code: string } => {
  const error = new Error(message) as Error & { code: string; cause?: unknown };
  error.code = 'STORE_UNAVAILABLE';
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

const createEmptyStore = (): StoreRow => ({
  version: 1,
  users: [],
  memberships: [],
  payments: [],
  reflections: [],
  providerChallenges: [],
  providerSessions: [],
});

const ensureStoreFile = (): void => {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {
      return;
    }

    if (fs.existsSync(STORE_TMP_FILE)) {
      fs.renameSync(STORE_TMP_FILE, STORE_FILE);
      setRecoveryStatus(
        'initialized_from_tmp',
        'Primary store was missing; recovered from temp file.'
      );
      return;
    }

    if (fs.existsSync(STORE_BACKUP_FILE)) {
      fs.copyFileSync(STORE_BACKUP_FILE, STORE_FILE);
      setRecoveryStatus(
        'initialized_from_backup',
        'Primary store was missing; restored from backup file.'
      );
      return;
    }

    fs.writeFileSync(STORE_FILE, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
    setRecoveryStatus(
      'initialized_empty',
      'Primary store did not exist and was initialized as empty.'
    );
  } catch (error) {
    setRecoveryStatus('store_unreadable', 'Failed while initializing store files.');
    throw toStoreError('[STORE][FATAL] Unable to initialize runtime store files', error);
  }
};

const parseStore = (raw: string): StoreRow => {
  if (!raw.trim()) return createEmptyStore();
  const parsed = JSON.parse(raw) as Partial<StoreRow>;
  return {
    version: 1,
    users: Array.isArray(parsed.users) ? parsed.users : [],
    memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    reflections: Array.isArray(parsed.reflections) ? parsed.reflections : [],
    providerChallenges: Array.isArray(parsed.providerChallenges)
      ? parsed.providerChallenges
      : [],
    providerSessions: Array.isArray(parsed.providerSessions)
      ? parsed.providerSessions
      : [],
  };
};

const tryReadStore = (filePath: string): StoreRow => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseStore(raw);
};

const loadStore = (): StoreRow => {
  ensureStoreFile();

  try {
    const parsed = tryReadStore(STORE_FILE);
    setRecoveryStatus('healthy', 'Primary store read successfully.');
    return parsed;
  } catch (primaryError) {
    if (fs.existsSync(STORE_BACKUP_FILE)) {
      try {
        const restored = tryReadStore(STORE_BACKUP_FILE);
        fs.copyFileSync(STORE_BACKUP_FILE, STORE_FILE);
        console.warn('[STORE][RECOVERY] Restored runtime store from backup file.');
        setRecoveryStatus(
          'recovered_from_backup',
          'Primary store was unreadable; recovered from backup.'
        );
        return restored;
      } catch (backupError) {
        setRecoveryStatus(
          'store_unreadable',
          'Primary and backup stores are unreadable.'
        );
        throw toStoreError(
          '[STORE][FATAL] Runtime store and backup are unreadable',
          backupError
        );
      }
    }

    setRecoveryStatus(
      'store_unreadable',
      'Primary store unreadable and no backup store available.'
    );
    throw toStoreError(
      '[STORE][FATAL] Runtime store is unreadable and no backup is available',
      primaryError
    );
  }
};

const saveStore = (store: StoreRow): void => {
  ensureStoreFile();

  try {
    const serialized = JSON.stringify(store, null, 2);
    fs.writeFileSync(STORE_TMP_FILE, serialized, 'utf8');

    if (fs.existsSync(STORE_FILE)) {
      fs.copyFileSync(STORE_FILE, STORE_BACKUP_FILE);
      fs.rmSync(STORE_FILE, { force: true });
    }

    fs.renameSync(STORE_TMP_FILE, STORE_FILE);
    setRecoveryStatus('healthy', 'Store persisted successfully.');
  } catch (error) {
    setRecoveryStatus('save_failed', 'Store persistence failed.');
    throw toStoreError('[STORE][FATAL] Failed to persist runtime store', error);
  }
};

const nowIso = (): string => new Date().toISOString();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toDate = (value: string): Date => new Date(value);

const normalizeInterests = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
};

const normalizePrivacySettings = (value: unknown): UserPrivacySettings => {
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
): UserMediaAsset => {
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

const revealSensitiveFieldSafe = (
  field: 'phoneNumber' | 'walletDid',
  value: string | null | undefined
): string | null => {
  try {
    return revealSensitiveField(field, value);
  } catch (error) {
    console.error(`[SECURITY][WARN] Failed to reveal ${field} from local store`, error);
    return null;
  }
};

const rowToUser = (row: UserRow): LocalUserRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  handle: row.handle || null,
  bio: row.bio || null,
  location: row.location || null,
  dateOfBirth: row.dateOfBirth ? toDate(row.dateOfBirth) : null,
  avatarUrl: row.avatarUrl || null,
  bannerUrl: row.bannerUrl || null,
  profileMedia: normalizeProfileMedia(row.profileMedia, row.avatarUrl || null, row.bannerUrl || null),
  interests: normalizeInterests(row.interests),
  twitterUrl: row.twitterUrl || null,
  githubUrl: row.githubUrl || null,
  websiteUrl: row.websiteUrl || null,
  privacySettings: normalizePrivacySettings(row.privacySettings),
  password: row.password,
  passwordFingerprint: row.passwordFingerprint,
  tier: row.tier,
  subscriptionStatus: row.subscriptionStatus,
  subscriptionStartDate: row.subscriptionStartDate ? toDate(row.subscriptionStartDate) : null,
  subscriptionEndDate: row.subscriptionEndDate ? toDate(row.subscriptionEndDate) : null,
  profileBackgroundVideo: row.profileBackgroundVideo,
  phoneNumber: revealSensitiveFieldSafe('phoneNumber', row.phoneNumber),
  twoFactorMethod: row.twoFactorMethod,
  walletDid: revealSensitiveFieldSafe('walletDid', row.walletDid),
  pendingPhoneOtpHash: row.pendingPhoneOtpHash,
  pendingPhoneOtpExpiresAt: row.pendingPhoneOtpExpiresAt ? toDate(row.pendingPhoneOtpExpiresAt) : null,
  pendingPhoneOtpAttempts: row.pendingPhoneOtpAttempts,
  failedSignInAttempts: row.failedSignInAttempts,
  lockoutUntil: row.lockoutUntil ? toDate(row.lockoutUntil) : null,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
});

const rowToMembership = (row: MembershipRow): LocalMembershipRecord => ({
  id: row.id,
  userId: row.userId,
  tier: row.tier,
  status: row.status,
  startDate: toDate(row.startDate),
  endDate: row.endDate ? toDate(row.endDate) : null,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
});

const rowToPayment = (row: PaymentRow): LocalPaymentRecord => ({
  ...row,
  createdAt: toDate(row.createdAt),
});

const rowToReflection = (row: ReflectionRow): LocalReflectionRecord => ({
  ...row,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
});

const rowToProviderChallenge = (
  row: ProviderChallengeRow
): LocalProviderChallengeRecord => ({
  id: row.id,
  did: row.did,
  nonce: row.nonce,
  statement: row.statement,
  expiresAt: toDate(row.expiresAt),
  usedAt: row.usedAt ? toDate(row.usedAt) : null,
  createdAt: toDate(row.createdAt),
});

const rowToProviderSession = (
  row: ProviderSessionRow
): LocalProviderSessionRecord => ({
  id: row.id,
  did: row.did,
  scopes: JSON.parse(row.scopesJson),
  issuedAt: toDate(row.issuedAt),
  expiresAt: toDate(row.expiresAt),
  revokedAt: row.revokedAt ? toDate(row.revokedAt) : null,
  createdAt: toDate(row.createdAt),
});

const uniqueId = (): string => crypto.randomUUID();

const inspectStoreFile = (filePath: string): StoreFileHealth => {
  if (!fs.existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
      readable: false,
      jsonValid: null,
      sizeBytes: null,
      modifiedAt: null,
      error: null,
    };
  }

  try {
    const stats = fs.statSync(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    let jsonValid = false;
    let parseError: string | null = null;
    try {
      parseStore(raw);
      jsonValid = true;
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    return {
      path: filePath,
      exists: true,
      readable: true,
      jsonValid,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      error: parseError,
    };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      readable: false,
      jsonValid: false,
      sizeBytes: null,
      modifiedAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const localStore = {
  getStoreFilePath(): string {
    return STORE_FILE;
  },

  getUserByEmail(email: string): LocalUserRecord | null {
    const target = normalizeEmail(email);
    const store = loadStore();
    const row = store.users.find((user) => user.email === target);
    return row ? rowToUser(row) : null;
  },

  getUserById(id: string): LocalUserRecord | null {
    const store = loadStore();
    const row = store.users.find((user) => user.id === id);
    return row ? rowToUser(row) : null;
  },

  listUsers(limit = 250): LocalUserRecord[] {
    const store = loadStore();
    return store.users
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(rowToUser);
  },

  findUserByPasswordFingerprint(passwordFingerprint: string): LocalUserRecord | null {
    const store = loadStore();
    const row = store.users.find(
      (user) => user.passwordFingerprint && user.passwordFingerprint === passwordFingerprint
    );
    return row ? rowToUser(row) : null;
  },

  createUser(input: CreateUserInput): LocalUserRecord {
    const store = loadStore();
    const email = normalizeEmail(input.email);
    const existing = store.users.find((row) => row.email === email);
    if (existing) {
      const duplicateError = new Error('Duplicate email');
      (duplicateError as Error & { code?: string }).code = 'DUPLICATE_USER';
      throw duplicateError;
    }

    const timestamp = nowIso();
    const row: UserRow = {
      id: uniqueId(),
      email,
      name: input.name || null,
      handle: input.handle?.trim() || null,
      bio: input.bio?.trim() || null,
      location: input.location?.trim() || null,
      dateOfBirth: input.dateOfBirth ? input.dateOfBirth.toISOString() : null,
      avatarUrl: input.avatarUrl?.trim() || null,
      bannerUrl: input.bannerUrl?.trim() || null,
      profileMedia: normalizeProfileMedia(
        input.profileMedia,
        input.avatarUrl?.trim() || null,
        input.bannerUrl?.trim() || null
      ),
      interests: normalizeInterests(input.interests),
      twitterUrl: input.twitterUrl?.trim() || null,
      githubUrl: input.githubUrl?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
      privacySettings: normalizePrivacySettings(input.privacySettings),
      password: input.password,
      passwordFingerprint: input.passwordFingerprint || null,
      tier: input.tier,
      subscriptionStatus: 'inactive',
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      profileBackgroundVideo: null,
      phoneNumber: protectSensitiveField('phoneNumber', input.phoneNumber?.trim() || null),
      twoFactorMethod: input.twoFactorMethod || 'none',
      walletDid: protectSensitiveField('walletDid', input.walletDid?.trim() || null),
      pendingPhoneOtpHash: null,
      pendingPhoneOtpExpiresAt: null,
      pendingPhoneOtpAttempts: 0,
      failedSignInAttempts: 0,
      lockoutUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    store.users.push(row);
    saveStore(store);
    return rowToUser(row);
  },

  updateUser(id: string, updates: UpdateUserInput): LocalUserRecord | null {
    const store = loadStore();
    const index = store.users.findIndex((user) => user.id === id);
    if (index < 0) return null;

    const row = store.users[index];

    if (updates.name !== undefined) row.name = updates.name;
    if (updates.handle !== undefined) row.handle = updates.handle;
    if (updates.bio !== undefined) row.bio = updates.bio;
    if (updates.location !== undefined) row.location = updates.location;
    if (updates.dateOfBirth !== undefined) {
      row.dateOfBirth = updates.dateOfBirth ? updates.dateOfBirth.toISOString() : null;
    }
    if (updates.avatarUrl !== undefined) row.avatarUrl = updates.avatarUrl;
    if (updates.bannerUrl !== undefined) row.bannerUrl = updates.bannerUrl;
    if (updates.profileMedia !== undefined) {
      row.profileMedia = normalizeProfileMedia(
        updates.profileMedia,
        row.avatarUrl || null,
        row.bannerUrl || null
      );
    } else if (updates.avatarUrl !== undefined || updates.bannerUrl !== undefined) {
      row.profileMedia = normalizeProfileMedia(
        row.profileMedia,
        row.avatarUrl || null,
        row.bannerUrl || null
      );
    }
    if (updates.interests !== undefined) row.interests = normalizeInterests(updates.interests);
    if (updates.twitterUrl !== undefined) row.twitterUrl = updates.twitterUrl;
    if (updates.githubUrl !== undefined) row.githubUrl = updates.githubUrl;
    if (updates.websiteUrl !== undefined) row.websiteUrl = updates.websiteUrl;
    if (updates.privacySettings !== undefined) {
      row.privacySettings = normalizePrivacySettings(updates.privacySettings);
    }
    if (updates.password !== undefined) row.password = updates.password;
    if (updates.passwordFingerprint !== undefined) {
      row.passwordFingerprint = updates.passwordFingerprint;
    }
    if (updates.tier !== undefined) row.tier = updates.tier;
    if (updates.subscriptionStatus !== undefined) {
      row.subscriptionStatus = updates.subscriptionStatus;
    }
    if (updates.subscriptionStartDate !== undefined) {
      row.subscriptionStartDate = updates.subscriptionStartDate
        ? updates.subscriptionStartDate.toISOString()
        : null;
    }
    if (updates.subscriptionEndDate !== undefined) {
      row.subscriptionEndDate = updates.subscriptionEndDate
        ? updates.subscriptionEndDate.toISOString()
        : null;
    }
    if (updates.profileBackgroundVideo !== undefined) {
      row.profileBackgroundVideo = updates.profileBackgroundVideo;
    }
    if (updates.phoneNumber !== undefined) {
      row.phoneNumber = protectSensitiveField('phoneNumber', updates.phoneNumber);
    }
    if (updates.twoFactorMethod !== undefined) {
      row.twoFactorMethod = updates.twoFactorMethod;
    }
    if (updates.walletDid !== undefined) {
      row.walletDid = protectSensitiveField('walletDid', updates.walletDid);
    }
    if (updates.pendingPhoneOtpHash !== undefined) {
      row.pendingPhoneOtpHash = updates.pendingPhoneOtpHash;
    }
    if (updates.pendingPhoneOtpExpiresAt !== undefined) {
      row.pendingPhoneOtpExpiresAt = updates.pendingPhoneOtpExpiresAt
        ? updates.pendingPhoneOtpExpiresAt.toISOString()
        : null;
    }
    if (updates.pendingPhoneOtpAttempts !== undefined) {
      row.pendingPhoneOtpAttempts = updates.pendingPhoneOtpAttempts;
    }
    if (updates.failedSignInAttempts !== undefined) {
      row.failedSignInAttempts = updates.failedSignInAttempts;
    }
    if (updates.lockoutUntil !== undefined) {
      row.lockoutUntil = updates.lockoutUntil
        ? updates.lockoutUntil.toISOString()
        : null;
    }

    row.updatedAt = nowIso();
    store.users[index] = row;
    saveStore(store);
    return rowToUser(row);
  },

  upsertMembership(input: UpsertMembershipInput): LocalMembershipRecord {
    const store = loadStore();
    const existingIndex = store.memberships.findIndex((row) => row.userId === input.userId);
    const timestamp = nowIso();
    const startDateIso = (input.startDate || new Date()).toISOString();

    if (existingIndex >= 0) {
      const row = store.memberships[existingIndex];
      row.tier = input.tier;
      row.status = input.status;
      row.startDate = startDateIso;
      row.updatedAt = timestamp;
      store.memberships[existingIndex] = row;
      saveStore(store);
      return rowToMembership(row);
    }

    const created: MembershipRow = {
      id: uniqueId(),
      userId: input.userId,
      tier: input.tier,
      status: input.status,
      startDate: startDateIso,
      endDate: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.memberships.push(created);
    saveStore(store);
    return rowToMembership(created);
  },

  getMembershipByUserId(userId: string): LocalMembershipRecord | null {
    const store = loadStore();
    const row = store.memberships.find((membership) => membership.userId === userId);
    return row ? rowToMembership(row) : null;
  },

  listMembershipsByUserId(userId: string, limit = 1): LocalMembershipRecord[] {
    const store = loadStore();
    return store.memberships
      .filter((membership) => membership.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(rowToMembership);
  },

  createPayment(input: CreatePaymentInput): LocalPaymentRecord {
    const store = loadStore();
    const payment: PaymentRow = {
      id: uniqueId(),
      userId: input.userId,
      membershipId: input.membershipId,
      amount: input.amount,
      currency: input.currency || 'USD',
      tier: input.tier,
      status: input.status || 'completed',
      paymentMethod: input.paymentMethod || 'mock',
      description: input.description || null,
      createdAt: nowIso(),
    };

    store.payments.push(payment);
    saveStore(store);
    return rowToPayment(payment);
  },

  listPaymentsByUserId(userId: string, limit = 5): LocalPaymentRecord[] {
    const store = loadStore();
    return store.payments
      .filter((payment) => payment.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(rowToPayment);
  },

  hasPaymentDescriptionMarker(marker: string): boolean {
    const normalizedMarker = String(marker || '').trim();
    if (!normalizedMarker) {
      return false;
    }

    const store = loadStore();
    return store.payments.some((payment) =>
      String(payment.description || '').includes(normalizedMarker)
    );
  },

  createReflection(input: CreateReflectionInput): LocalReflectionRecord {
    const store = loadStore();
    const timestamp = nowIso();
    const reflection: ReflectionRow = {
      id: uniqueId(),
      userId: input.userId,
      content: input.content || null,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    store.reflections.push(reflection);
    saveStore(store);
    return rowToReflection(reflection);
  },

  listReflectionsByUserId(userId: string): LocalReflectionRecord[] {
    const store = loadStore();
    return store.reflections
      .filter((reflection) => reflection.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(rowToReflection);
  },

  createProviderChallenge(input: CreateProviderChallengeInput): LocalProviderChallengeRecord {
    const store = loadStore();
    const createdAt = (input.createdAt || new Date()).toISOString();
    const row: ProviderChallengeRow = {
      id: input.id,
      did: input.did,
      nonce: input.nonce,
      statement: input.statement,
      expiresAt: input.expiresAt.toISOString(),
      usedAt: null,
      createdAt,
    };

    store.providerChallenges = store.providerChallenges.filter((challenge) => challenge.id !== row.id);
    store.providerChallenges.push(row);
    saveStore(store);
    return rowToProviderChallenge(row);
  },

  getProviderChallengeById(id: string): LocalProviderChallengeRecord | null {
    const store = loadStore();
    const row = store.providerChallenges.find((challenge) => challenge.id === id);
    return row ? rowToProviderChallenge(row) : null;
  },

  markProviderChallengeUsed(id: string): void {
    const store = loadStore();
    const row = store.providerChallenges.find((challenge) => challenge.id === id);
    if (!row || row.usedAt) return;
    row.usedAt = nowIso();
    saveStore(store);
  },

  createProviderSession(input: CreateProviderSessionInput): LocalProviderSessionRecord {
    const store = loadStore();
    const row: ProviderSessionRow = {
      id: input.id,
      did: input.did,
      scopesJson: JSON.stringify(input.scopes),
      issuedAt: input.issuedAt.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
      revokedAt: null,
      createdAt: (input.createdAt || new Date()).toISOString(),
    };

    store.providerSessions = store.providerSessions.filter((session) => session.id !== row.id);
    store.providerSessions.push(row);
    saveStore(store);
    return rowToProviderSession(row);
  },

  getProviderSessionById(id: string): LocalProviderSessionRecord | null {
    const store = loadStore();
    const row = store.providerSessions.find((session) => session.id === id);
    return row ? rowToProviderSession(row) : null;
  },

  revokeProviderSession(id: string): void {
    const store = loadStore();
    const row = store.providerSessions.find((session) => session.id === id);
    if (!row || row.revokedAt) return;
    row.revokedAt = nowIso();
    saveStore(store);
  },

  getDiagnostics(): LocalStoreDiagnostics {
    ensureStoreFile();

    const primary = inspectStoreFile(STORE_FILE);
    const backup = inspectStoreFile(STORE_BACKUP_FILE);
    const temp = inspectStoreFile(STORE_TMP_FILE);

    let source: 'primary' | 'backup' | 'none' = 'none';
    let active: StoreRow | null = null;

    if (primary.exists && primary.readable && primary.jsonValid) {
      active = tryReadStore(STORE_FILE);
      source = 'primary';
    } else if (backup.exists && backup.readable && backup.jsonValid) {
      active = tryReadStore(STORE_BACKUP_FILE);
      source = 'backup';
    }

    return {
      generatedAt: nowIso(),
      files: {
        primary,
        backup,
        temp,
      },
      lastRecoveryStatus: { ...lastRecoveryStatus },
      activeStore: {
        source,
        users: active?.users.length ?? 0,
        memberships: active?.memberships.length ?? 0,
        payments: active?.payments.length ?? 0,
        reflections: active?.reflections.length ?? 0,
        providerChallenges: active?.providerChallenges.length ?? 0,
        providerSessions: active?.providerSessions.length ?? 0,
      },
    };
  },
};
