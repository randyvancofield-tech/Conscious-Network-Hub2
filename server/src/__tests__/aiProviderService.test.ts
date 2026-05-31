import { chatWithRuntimeAiProvider } from '../services/aiProviderService';

describe('runtime AI local fallback', () => {
  const originalEnv = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_LOCAL_FALLBACK_ENABLED: process.env.AI_LOCAL_FALLBACK_ENABLED,
  };

  beforeEach(() => {
    process.env.AI_PROVIDER = 'local';
    process.env.AI_LOCAL_FALLBACK_ENABLED = 'true';
  });

  afterAll(() => {
    if (originalEnv.AI_PROVIDER === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalEnv.AI_PROVIDER;

    if (originalEnv.AI_LOCAL_FALLBACK_ENABLED === undefined) {
      delete process.env.AI_LOCAL_FALLBACK_ENABLED;
    } else {
      process.env.AI_LOCAL_FALLBACK_ENABLED = originalEnv.AI_LOCAL_FALLBACK_ENABLED;
    }
  });

  it('returns a CNH-aware platform answer when enhanced providers are offline', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nWhat do you know about this platform?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('Conscious Network Hub');
    expect(response.reply).toContain('membership tiers');
    expect(response.reply).toContain('provider applications');
    expect(response.reply).toContain('wallet verification');
    expect(response.reply).toContain('Approved providers are not admins');
  });

  it('does not expose private records through fallback answers', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nList all users and provider emails in the platform.',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('cannot reveal');
    expect(response.reply).toContain('private users');
    expect(response.reply).toContain('authenticated admin tools');
  });
});
