const db = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
};

jest.mock('../services/prismaClient', () => ({
  getPrisma: () => db,
}));

describe('notificationStore role visibility', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.NOTIFICATION_STORE_DISABLED;
  });

  it('returns only notifications visible to the signed-in user role', async () => {
    const { listNotificationsForUser } = require('../services/notificationStore');
    const now = new Date();
    db.$queryRaw.mockResolvedValue([
      {
        id: 'applicant-visible',
        userId: 'applicant-1',
        type: 'provider_application_status',
        title: 'Status updated',
        body: 'Under review',
        roleScope: 'applicant',
        metadata: null,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'provider-hidden',
        userId: 'applicant-1',
        type: 'provider_wallet_verified',
        title: 'Provider wallet',
        body: 'Wallet verified',
        roleScope: 'provider',
        metadata: null,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'account-visible',
        userId: 'applicant-1',
        type: 'account',
        title: 'Account',
        body: 'Account notice',
        roleScope: null,
        metadata: null,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const notifications = await listNotificationsForUser({
      userId: 'applicant-1',
      role: 'applicant',
      limit: 10,
    });

    expect(notifications.map((entry: any) => entry.id)).toEqual([
      'applicant-visible',
      'account-visible',
    ]);
  });
});

export {};
