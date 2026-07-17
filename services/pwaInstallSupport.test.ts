import { describe, expect, it } from 'vitest';
import { getPwaInstallabilityState } from './pwaInstallSupport';

describe('getPwaInstallabilityState', () => {
  it('identifies iOS Safari guidance for home screen installation', () => {
    const state = getPwaInstallabilityState({
      navigator: { standalone: false, isSecureContext: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
      location: { hostname: 'conscious-network.org', protocol: 'https:' },
    });

    expect(state.browserLabel).toBe('Safari on iOS');
    expect(state.platformLabel).toBe('iPhone or iPad');
    expect(state.menuSteps[0]).toContain('Safari');
    expect(state.isSecureContext).toBe(true);
  });

  it('flags insecure origins as requiring HTTPS before install', () => {
    const state = getPwaInstallabilityState({
      navigator: { standalone: false, isSecureContext: false, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' },
      location: { hostname: 'example.com', protocol: 'http:' },
    });

    expect(state.isSecureContext).toBe(false);
    expect(state.primaryActionLabel).toBe('Open install guide');
    expect(state.menuGuideSummary).toContain('HTTPS');
  });
});
