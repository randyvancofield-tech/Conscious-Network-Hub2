import { describe, expect, it } from 'vitest';
import {
  clearClientWisdomContext,
  createClientIsolatedSearchContext,
  getClientWisdomContext,
  sanitizeExternalRequestPayload,
} from './wisdomCompliance';

describe('wisdom compliance safeguards', () => {
  it('removes proprietary runtime variables before an external payload leaves the client', () => {
    const payload = {
      query: 'community wellness',
      runtimeContext: 'The current browser context includes __cnhActiveWalletProvider and hcn_pending_wallet_auth_intent_v1.',
      metadata: {
        filePath: '/server/src/routes/providerAuth.ts',
        envKey: 'process.env.PROVIDER_WALLET_CHAIN_ID',
      },
    };

    const sanitized = sanitizeExternalRequestPayload(payload);

    expect(sanitized.query).toBe('community wellness');
    expect(sanitized.runtimeContext).not.toContain('__cnhActiveWalletProvider');
    expect(sanitized.runtimeContext).not.toContain('hcn_pending_wallet_auth_intent_v1');
    expect(sanitized.metadata.filePath).toBeUndefined();
    expect(sanitized.metadata.envKey).toBeUndefined();
  });

  it('clears the isolated search context after the reply lifecycle completes', () => {
    createClientIsolatedSearchContext('Open web search summary', { source: 'browser' });

    expect(getClientWisdomContext()).toContain('Open web search summary');

    clearClientWisdomContext();

    expect(getClientWisdomContext()).toBe('');
  });
});
