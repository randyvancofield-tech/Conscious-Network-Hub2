export type RuntimeAiProvider = 'ollama' | 'openrouter' | 'groq' | 'local';

export interface RuntimeAiRequest {
  message: string;
  systemPrompt: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface RuntimeAiResponse {
  provider: RuntimeAiProvider;
  reply: string;
  processingTimeMs: number;
}

export interface RuntimeProviderStatus {
  provider: RuntimeAiProvider;
  configured: boolean;
  detail: string;
}

const trimEnv = (name: string): string => String(process.env[name] || '').trim();
const envEnabled = (name: string, defaultValue = true): boolean => {
  const raw = trimEnv(name).toLowerCase();
  if (!raw) return defaultValue;
  return raw !== 'false' && raw !== '0' && raw !== 'off';
};

const getTimeoutMs = (): number => {
  const parsed = Number(trimEnv('AI_PROVIDER_TIMEOUT_MS'));
  return Number.isFinite(parsed) && parsed >= 1000 ? Math.min(parsed, 60000) : 15000;
};

const withTimeout = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeProvider = (value: string): RuntimeAiProvider | 'auto' | 'disabled' => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ollama' || normalized === 'openrouter' || normalized === 'groq' || normalized === 'local') {
    return normalized;
  }
  if (normalized === 'disabled' || normalized === 'off') return 'disabled';
  return 'auto';
};

const buildMessages = (input: RuntimeAiRequest): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> => [
  { role: 'system', content: input.systemPrompt },
  ...(input.conversationHistory || []).slice(-16),
  { role: 'user', content: input.message },
];

const callOllama = async (input: RuntimeAiRequest): Promise<RuntimeAiResponse> => {
  const start = Date.now();
  const baseUrl = (trimEnv('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = trimEnv('OLLAMA_MODEL') || trimEnv('AI_LOCAL_MODEL') || 'llama3.1:8b';

  const payload = {
    model,
    messages: buildMessages(input),
    stream: false,
    options: {
      temperature: 0.4,
      num_predict: 800,
    },
  };

  const response = await withTimeout((signal) =>
    fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  );

  if (!response.ok) {
    throw new Error(`Ollama request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as any;
  const reply = String(data?.message?.content || data?.response || '').trim();
  if (!reply) throw new Error('Ollama returned an empty response');

  return {
    provider: 'ollama',
    reply,
    processingTimeMs: Date.now() - start,
  };
};

const callOpenAiCompatible = async (
  provider: 'openrouter' | 'groq',
  input: RuntimeAiRequest
): Promise<RuntimeAiResponse> => {
  const start = Date.now();
  const isOpenRouter = provider === 'openrouter';
  const apiKey = trimEnv(isOpenRouter ? 'OPENROUTER_API_KEY' : 'GROQ_API_KEY');
  const model =
    trimEnv(isOpenRouter ? 'OPENROUTER_MODEL' : 'GROQ_MODEL') ||
    (isOpenRouter ? 'meta-llama/llama-3.1-8b-instruct:free' : 'llama-3.1-8b-instant');
  const baseUrl =
    trimEnv(isOpenRouter ? 'OPENROUTER_BASE_URL' : 'GROQ_BASE_URL') ||
    (isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.groq.com/openai/v1');

  if (!apiKey) throw new Error(`${provider} API key is not configured`);

  const response = await withTimeout((signal) =>
    fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(isOpenRouter
          ? {
              'HTTP-Referer': trimEnv('FRONTEND_BASE_URL') || 'https://conscious-network.org',
              'X-Title': 'Conscious Network Hub',
            }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(input),
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal,
    })
  );

  if (!response.ok) {
    throw new Error(`${provider} request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as any;
  const reply = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!reply) throw new Error(`${provider} returned an empty response`);

  return {
    provider,
    reply,
    processingTimeMs: Date.now() - start,
  };
};

const localFallback = async (input: RuntimeAiRequest): Promise<RuntimeAiResponse> => {
  const start = Date.now();
  const trimmedMessage = input.message.slice(0, 300);
  const reply = [
    'I can help with a privacy-first local response while the live model provider is unavailable.',
    '',
    `Your request: ${trimmedMessage}`,
    '',
    'Immediate path: use the indexed platform context, keep private profile data isolated to this session, and escalate medical, mental-health, legal, or safety-critical concerns to qualified local professionals.',
    '',
    'For a fuller generative answer, start Ollama locally or configure Groq/OpenRouter/OpenAI/Vertex in the backend environment.',
  ].join('\n');

  return {
    provider: 'local',
    reply,
    processingTimeMs: Date.now() - start,
  };
};

export const getRuntimeProviderStatus = (): RuntimeProviderStatus[] => [
  {
    provider: 'ollama',
    configured: envEnabled('AI_ENABLE_OLLAMA', true),
    detail: trimEnv('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434',
  },
  {
    provider: 'openrouter',
    configured: Boolean(trimEnv('OPENROUTER_API_KEY')),
    detail: trimEnv('OPENROUTER_MODEL') || 'meta-llama/llama-3.1-8b-instruct:free',
  },
  {
    provider: 'groq',
    configured: Boolean(trimEnv('GROQ_API_KEY')),
    detail: trimEnv('GROQ_MODEL') || 'llama-3.1-8b-instant',
  },
  {
    provider: 'local',
    configured: envEnabled('AI_LOCAL_FALLBACK_ENABLED', true),
    detail: 'deterministic privacy-safe fallback',
  },
];

export const hasRuntimeAiProvider = (): boolean =>
  normalizeProvider(trimEnv('AI_PROVIDER')) !== 'disabled' &&
  getRuntimeProviderStatus().some((status) => status.configured);

export const chatWithRuntimeAiProvider = async (input: RuntimeAiRequest): Promise<RuntimeAiResponse> => {
  const preference = normalizeProvider(trimEnv('AI_PROVIDER'));
  if (preference === 'disabled') throw new Error('Runtime AI provider is disabled');

  const order: RuntimeAiProvider[] =
    preference === 'auto'
      ? ['ollama', 'openrouter', 'groq', 'local']
      : [preference, ...(preference === 'local' ? [] : ['local' as const])];

  const failures: string[] = [];
  for (const provider of order) {
    const status = getRuntimeProviderStatus().find((entry) => entry.provider === provider);
    if (!status?.configured) continue;

    try {
      if (provider === 'ollama') return await callOllama(input);
      if (provider === 'openrouter' || provider === 'groq') return await callOpenAiCompatible(provider, input);
      return await localFallback(input);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`No runtime AI provider succeeded. ${failures.join(' | ')}`);
};
