const db = {
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('../services/prismaClient', () => ({
  getPrisma: () => db,
}));

describe('recoveryCodeService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.AUTH_TOKEN_SECRET = 'phase4r-recovery-code-secret';
  });

  it('hashes recovery codes instead of storing raw code values', async () => {
    const {
      createRecoveryCodesForUser,
      hashRecoveryCode,
      normalizeRecoveryCode,
    } = require('../services/recoveryCodeService');
    db.$executeRaw.mockResolvedValue(1);

    const codes: string[] = await createRecoveryCodesForUser('user-1', 2);

    expect(codes).toHaveLength(2);
    for (const code of codes) {
      const normalized = normalizeRecoveryCode(code);
      const hash = hashRecoveryCode(code);
      expect(hash).not.toContain(normalized);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      const rawQueryValues = db.$executeRaw.mock.calls.flatMap((call) => Array.from(call).slice(1));
      expect(rawQueryValues).not.toContain(code);
      expect(rawQueryValues).not.toContain(normalized);
    }
  });

  it('consumes a recovery code once', async () => {
    const { hashRecoveryCode, verifyAndConsumeRecoveryCode } = require('../services/recoveryCodeService');
    const code = 'CNH-ABCD-EFGH-IJKL';
    const record = {
      id: 'recovery-1',
      userId: 'user-1',
      codeHash: hashRecoveryCode(code),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let consumed = false;
    db.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const query = Array.from(strings).join(' ');
      if (query.includes('SELECT') && !consumed) return Promise.resolve([record]);
      if (query.includes('UPDATE') && !consumed) {
        consumed = true;
        return Promise.resolve([{ ...record, usedAt: new Date() }]);
      }
      return Promise.resolve([]);
    });

    const first = await verifyAndConsumeRecoveryCode('user-1', code);
    const second = await verifyAndConsumeRecoveryCode('user-1', code);

    expect(first?.id).toBe('recovery-1');
    expect(second).toBeNull();
  });
});
