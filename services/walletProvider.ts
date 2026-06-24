export type WalletProviderState =
  | 'desktop_extension_available'
  | 'mobile_provider_available'
  | 'metamask_mobile_browser'
  | 'mobile_missing_provider'
  | 'desktop_missing_provider';

export interface WalletProviderEnvironment {
  provider: any | null;
  providerName: string | null;
  hasProvider: boolean;
  isMobile: boolean;
  isStandaloneApp: boolean;
  isMetaMask: boolean;
  isMetaMaskMobileBrowser: boolean;
  state: WalletProviderState;
  guidance: string;
  actionLabel: string | null;
  deepLinkUrl: string | null;
}

const MOBILE_USER_AGENT_PATTERN =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

const METAMASK_MOBILE_USER_AGENT_PATTERN = /metamaskmobile/i;
export const WALLET_PROVIDER_UPDATED_EVENT = 'cnh:wallet-provider-updated';

interface Eip6963ProviderDetail {
  info?: {
    name?: string;
    rdns?: string;
  };
  provider?: any;
}

const announcedWalletProviders: Eip6963ProviderDetail[] = [];
let eip6963DiscoveryInitialized = false;

const canUseWindow = (): boolean => typeof window !== 'undefined';

const isUsableWalletProvider = (provider: any): boolean => Boolean(provider?.request);

const isMetaMaskProvider = (provider: any, detail?: Eip6963ProviderDetail | null): boolean => {
  const name = String(detail?.info?.name || '').trim().toLowerCase();
  const rdns = String(detail?.info?.rdns || '').trim().toLowerCase();
  return Boolean(
    provider?.isMetaMask ||
      name.includes('metamask') ||
      rdns === 'io.metamask' ||
      rdns.includes('metamask')
  );
};

const walletProviderName = (provider: any, detail?: Eip6963ProviderDetail | null): string | null => {
  const announcedName = String(detail?.info?.name || '').trim();
  if (announcedName) return announcedName;
  if (isMetaMaskProvider(provider, detail)) return 'MetaMask';
  return null;
};

const notifyWalletProviderUpdated = (): void => {
  if (!canUseWindow()) return;
  window.dispatchEvent(new Event(WALLET_PROVIDER_UPDATED_EVENT));
};

const ensureEip6963Discovery = (): void => {
  if (!canUseWindow() || eip6963DiscoveryInitialized) return;
  eip6963DiscoveryInitialized = true;

  window.addEventListener('eip6963:announceProvider', (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (!detail?.provider) return;

    const alreadyKnown = announcedWalletProviders.some(
      (entry) =>
        entry.provider === detail.provider ||
        (entry.info?.rdns && detail.info?.rdns && entry.info.rdns === detail.info.rdns)
    );
    if (!alreadyKnown) {
      announcedWalletProviders.push(detail);
      notifyWalletProviderUpdated();
    }
  });
};

const requestEip6963Providers = (): void => {
  if (!canUseWindow()) return;
  ensureEip6963Discovery();
  window.dispatchEvent(new Event('eip6963:requestProvider'));
};

const collectInjectedWalletProviders = (): Eip6963ProviderDetail[] => {
  if (!canUseWindow()) return [];

  requestEip6963Providers();
  const ethereum = (window as any).ethereum || null;
  const injectedProviders = Array.isArray(ethereum?.providers)
    ? ethereum.providers
    : ethereum
      ? [ethereum]
      : [];
  const candidates: Eip6963ProviderDetail[] = [
    ...announcedWalletProviders,
    ...injectedProviders.map((provider: any) => ({ provider })),
  ];
  const seen = new Set<any>();

  return candidates.filter((detail) => {
    const provider = detail.provider;
    if (!isUsableWalletProvider(provider) || seen.has(provider)) return false;
    seen.add(provider);
    return true;
  });
};

const selectWalletProvider = (): Eip6963ProviderDetail | null => {
  const providers = collectInjectedWalletProviders();
  return (
    providers.find((detail) => isMetaMaskProvider(detail.provider, detail)) ||
    providers[0] ||
    null
  );
};

export const isLikelyMobileWalletDevice = (): boolean => {
  if (!canUseWindow()) return false;
  const navigatorAny = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  return Boolean(
    navigatorAny.userAgentData?.mobile ||
      MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent || '')
  );
};

const isStandaloneDisplayMode = (): boolean => {
  if (!canUseWindow()) return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
};

export const buildMetaMaskDappDeepLink = (rawUrl?: string): string | null => {
  const href = String(rawUrl || (canUseWindow() ? window.location.href : '')).trim();
  if (!href) return null;

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) {
      return null;
    }
    return `https://link.metamask.io/dapp/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export const detectWalletProviderEnvironment = (rawUrl?: string): WalletProviderEnvironment => {
  const selectedProvider = selectWalletProvider();
  const provider = selectedProvider?.provider || null;
  const providerName = walletProviderName(provider, selectedProvider);
  const hasProvider = Boolean(provider?.request);
  const isMobile = isLikelyMobileWalletDevice();
  const isStandaloneApp = isStandaloneDisplayMode();
  const userAgent = canUseWindow() ? navigator.userAgent || '' : '';
  const isMetaMask = isMetaMaskProvider(provider, selectedProvider);
  const isMetaMaskMobileBrowser =
    isMobile && (isMetaMask || METAMASK_MOBILE_USER_AGENT_PATTERN.test(userAgent));
  const deepLinkUrl = buildMetaMaskDappDeepLink(rawUrl);

  if (hasProvider && isMetaMaskMobileBrowser) {
    return {
      provider,
      providerName,
      hasProvider,
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'metamask_mobile_browser',
      guidance: 'MetaMask mobile browser is ready. Continue with the wallet signature.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (hasProvider && isMobile) {
    return {
      provider,
      providerName,
      hasProvider,
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'mobile_provider_available',
      guidance: 'A wallet-enabled mobile browser is ready. Continue with the wallet signature.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (hasProvider) {
    return {
      provider,
      providerName,
      hasProvider,
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'desktop_extension_available',
      guidance: `${providerName || 'Wallet extension'} detected. Continue with the gasless signature.`,
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (isMobile) {
    return {
      provider,
      providerName,
      hasProvider,
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'mobile_missing_provider',
      guidance: deepLinkUrl
        ? isStandaloneApp
          ? 'Open MetaMask to approve the wallet signature, then return to the installed HCN app.'
          : 'Open this page in the MetaMask browser to connect your wallet.'
        : 'Open this page in a wallet-enabled mobile browser to connect your wallet.',
      actionLabel: deepLinkUrl ? 'Open In MetaMask Browser' : null,
      deepLinkUrl,
    };
  }

  return {
    provider,
    providerName,
    hasProvider,
    isMobile,
    isStandaloneApp,
    isMetaMask,
    isMetaMaskMobileBrowser,
    state: 'desktop_missing_provider',
    guidance: 'Install or unlock MetaMask in this browser, then retry wallet verification.',
    actionLabel: null,
    deepLinkUrl,
  };
};

export const walletErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  const anyError = error as { code?: unknown; message?: unknown };
  const code = Number(anyError?.code);
  if (code === 4001) return 'Wallet connection or signature was rejected.';
  if (code === -32002) {
    return 'A wallet request is already open. Return to MetaMask and finish or cancel it.';
  }

  const message = String(anyError?.message || '').trim();
  if (/user rejected|rejected request|denied/i.test(message)) {
    return 'Wallet connection or signature was rejected.';
  }
  if (/already pending|request pending/i.test(message)) {
    return 'A wallet request is already open. Return to MetaMask and finish or cancel it.';
  }
  if (/chain|network/i.test(message)) {
    return `${message} Confirm the wallet network and retry.`;
  }
  return message || fallback;
};

export const readWalletChainId = async (provider: any): Promise<number | null> => {
  if (!provider?.request) return null;
  const rawChainId = await provider.request({ method: 'eth_chainId' });
  const normalized = String(rawChainId || '').trim();
  const parsed = normalized.startsWith('0x')
    ? parseInt(normalized, 16)
    : Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};
