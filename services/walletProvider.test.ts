import { describe, expect, it, vi } from 'vitest';
import { attachWalletProviderListeners } from './walletProvider';

describe('attachWalletProviderListeners', () => {
  it('registers and cleans up account and chain change listeners', () => {
    const provider = {
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    const onAccountsChanged = vi.fn();
    const onChainChanged = vi.fn();

    const cleanup = attachWalletProviderListeners(provider as any, onAccountsChanged, onChainChanged);

    expect(provider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    expect(provider.on).toHaveBeenCalledWith('chainChanged', expect.any(Function));

    cleanup();

    expect(provider.removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    expect(provider.removeListener).toHaveBeenCalledWith('chainChanged', expect.any(Function));
  });
});
