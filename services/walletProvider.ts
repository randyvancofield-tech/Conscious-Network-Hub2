export type WalletProviderState =
  | 'desktop_extension_available'
  | 'mobile_provider_available'
  | 'metamask_mobile_browser'
  | 'mobile_missing_provider'
  | 'desktop_missing_provider';

export interface WalletProviderEnvironment {
  provider: any | null;
  hasProvider: boolean;
  isMobile: boolean;
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

const canUseWindow = (): boolean => typeof window !== 'undefined';

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

export const buildMetaMaskDappDeepLink = (rawUrl?: string): string | null => {
  const href = String(rawUrl || (canUseWindow() ? window.location.href : '')).trim();
  if (!href) return null;

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) {
      return null;
    }
    return `https://metamask.app.link/dapp/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export const detectWalletProviderEnvironment = (rawUrl?: string): WalletProviderEnvironment => {
  const provider = canUseWindow() ? (window as any).ethereum || null : null;
  const hasProvider = Boolean(provider?.request);
  const isMobile = isLikelyMobileWalletDevice();
  const userAgent = canUseWindow() ? navigator.userAgent || '' : '';
  const isMetaMask = Boolean(provider?.isMetaMask);
  const isMetaMaskMobileBrowser =
    isMobile && (isMetaMask || METAMASK_MOBILE_USER_AGENT_PATTERN.test(userAgent));
  const deepLinkUrl = buildMetaMaskDappDeepLink(rawUrl);

  if (hasProvider && isMetaMaskMobileBrowser) {
    return {
      provider,
      hasProvider,
      isMobile,
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
      hasProvider,
      isMobile,
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
      hasProvider,
      isMobile,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'desktop_extension_available',
      guidance: 'Wallet extension detected. Continue with the gasless signature.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (isMobile) {
    return {
      provider,
      hasProvider,
      isMobile,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'mobile_missing_provider',
      guidance: deepLinkUrl
        ? 'Open this page in the MetaMask browser to connect your wallet.'
        : 'Open this page in a wallet-enabled mobile browser to connect your wallet.',
      actionLabel: deepLinkUrl ? 'Open In MetaMask Browser' : null,
      deepLinkUrl,
    };
  }

  return {
    provider,
    hasProvider,
    isMobile,
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
