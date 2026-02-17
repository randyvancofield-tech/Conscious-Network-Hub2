import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type TwoFactorMethod = 'none' | 'phone' | 'wallet';

type NullableIso = string | null;

interface UserRow {
  id: string;
  email: string;
  name: string | null;
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

export interface LocalUserRecord {
  id: string;
  email: string;
  name: string | null;
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
  password: string;
  passwordFingerprint?: string | null;
  tier: string;
  phoneNumber?: string | null;
  twoFactorMethod?: TwoFactorMethod;
  walletDid?: string | null;
}

interface UpdateUserInput {
  name?: string | null;
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
export const LOCAL_STORE_FILE = STORE_FILE;

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
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
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

const loadStore = (): StoreRow => {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_FILE, 'utf8');
  return parseStore(raw);
};

const saveStore = (store: StoreRow): void => {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
};

const nowIso = (): string => new Date().toISOString();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toDate = (value: string): Date => new Date(value);

const rowToUser = (row: UserRow): LocalUserRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  password: row.password,
  passwordFingerprint: row.passwordFingerprint,
  tier: row.tier,
  subscriptionStatus: row.subscriptionStatus,
  subscriptionStartDate: row.subscriptionStartDate ? toDate(row.subscriptionStartDate) : null,
  subscriptionEndDate: row.subscriptionEndDate ? toDate(row.subscriptionEndDate) : null,
  profileBackgroundVideo: row.profileBackgroundVideo,
  phoneNumber: row.phoneNumber,
  twoFactorMethod: row.twoFactorMethod,
  walletDid: row.walletDid,
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
      password: input.password,
      passwordFingerprint: input.passwordFingerprint || null,
      tier: input.tier,
      subscriptionStatus: 'inactive',
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      profileBackgroundVideo: null,
      phoneNumber: input.phoneNumber?.trim() || null,
      twoFactorMethod: input.twoFactorMethod || 'none',
      walletDid: input.walletDid?.trim() || null,
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
      row.phoneNumber = updates.phoneNumber;
    }
    if (updates.twoFactorMethod !== undefined) {
      row.twoFactorMethod = updates.twoFactorMethod;
    }
    if (updates.walletDid !== undefined) {
      row.walletDid = updates.walletDid;
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
};
