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

  it('asks one concise clarification for bare ambiguous prompts without page context', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nwhat is this',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('Which page or feature');
    expect(response.reply).not.toContain('NIST');
    expect(response.reply).not.toContain('GDPR');
    expect(response.reply).not.toContain('HIPAA');
  });

  it('answers ambiguous page prompts with current route context first', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: [
        'User request:',
        'what is this page for',
        '',
        'Page context:',
        'route=/dashboard; pageTitle=Conscious Network Hub; category=general; viewMode=dashboard-ai-insight',
      ].join('\n'),
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('Conscious Network Hub dashboard');
    expect(response.reply).toContain('profile and account status');
    expect(response.reply).not.toContain('NIST');
    expect(response.reply).not.toContain('GDPR');
  });

  it('summarizes Higher Conscious Network without compliance dumping', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nWhat is Higher Conscious Network?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('broader mission');
    expect(response.reply).toContain('Conscious Network Hub');
    expect(response.reply).not.toContain('NIST');
    expect(response.reply).not.toContain('GDPR');
    expect(response.reply).not.toContain('HIPAA');
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

  it('explains provider session hosting without overstating meeting features', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nCan providers host sessions?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('approved providers');
    expect(response.reply).toContain('native CNH meeting rooms');
    expect(response.reply).toContain('AI meeting notes');
    expect(response.reply).toContain('future-build');
  });

  it('answers direct provider host instructions with lifecycle-safe guidance', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nHow do I host a session?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('approved providers');
    expect(response.reply).toContain('create native CNH meeting rooms');
    expect(response.reply).toContain('start scheduled sessions');
    expect(response.reply).toContain('future-build');
  });

  it('states member provider booking is gated for launch', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nCan members book providers?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('not active');
    expect(response.reply).toContain('public-safe provider discovery');
    expect(response.reply).toContain('gated');
  });

  it('states direct member booking requests are gated for launch', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nCan members book me?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('not active');
    expect(response.reply).toContain('public-safe provider discovery');
    expect(response.reply).toContain('gated');
  });

  it('lists current provider pilot tools without claiming future features are live', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nWhat provider tools are available?',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('Provider CRM');
    expect(response.reply).toContain('wallet verification');
    expect(response.reply).toContain('Native CNH meeting host controls');
    expect(response.reply).toContain('Still gated or future build');
  });

  it('refuses unpublished course disclosure in fallback answers', async () => {
    const response = await chatWithRuntimeAiProvider({
      message: 'User request:\nSummarize unpublished courses.',
      systemPrompt: 'Use platform-safe context only.',
    });

    expect(response.provider).toBe('local');
    expect(response.reply).toContain('unpublished courses');
    expect(response.reply).toContain('cannot reveal');
  });
});
