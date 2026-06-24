import type { Hex, MetamaskConnectEVM } from '@metamask/connect-evm';

export type WalletProviderState =
  | 'desktop_extension_available'
  | 'mobile_provider_available'
  | 'mobile_metamask_connect_available'
  | 'metamask_mobile_browser'
  | 'mobile_missing_provider'
  | 'desktop_missing_provider';

export type WalletProviderTransport = 'injected' | 'metamask_connect' | 'none';

export interface WalletProviderEnvironment {
  provider: any | null;
  providerName: string | null;
  hasProvider: boolean;
  canConnect: boolean;
  transport: WalletProviderTransport;
  isMobile: boolean;
  isStandaloneApp: boolean;
  isMetaMask: boolean;
  isMetaMaskMobileBrowser: boolean;
  state: WalletProviderState;
  guidance: string;
  actionLabel: string | null;
  deepLinkUrl: string | null;
}

export interface WalletConnection {
  provider: any;
  accounts: string[];
  walletAddress: string;
  chainId: number | null;
  transport: Exclude<WalletProviderTransport, 'none'>;
  environment: WalletProviderEnvironment;
}

const MOBILE_USER_AGENT_PATTERN =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

const ANDROID_USER_AGENT_PATTERN = /android/i;
const IOS_USER_AGENT_PATTERN = /iphone|ipad|ipod/i;
const METAMASK_MOBILE_USER_AGENT_PATTERN = /metamaskmobile/i;
const METAMASK_CONNECT_DEEPLINK_BASE = 'metamask://connect';
const METAMASK_CONNECT_UNIVERSAL_LINK_BASE = 'https://metamask.app.link/connect';
export const WALLET_PROVIDER_UPDATED_EVENT = 'cnh:wallet-provider-updated';

const DEFAULT_PROVIDER_WALLET_CHAIN_ID = 1;
const DEFAULT_ETHEREUM_MAINNET_RPC_URL = 'https://cloudflare-eth.com';
const MAINNET_CHAIN_ID_HEX: Hex = '0x1';

let metamaskConnectClientPromise: Promise<MetamaskConnectEVM> | null = null;

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

const isLikelyAndroidWalletDevice = (): boolean =>
  canUseWindow() && ANDROID_USER_AGENT_PATTERN.test(navigator.userAgent || '');

const isLikelyIosWalletDevice = (): boolean =>
  canUseWindow() && IOS_USER_AGENT_PATTERN.test(navigator.userAgent || '');

const isStandaloneDisplayMode = (): boolean => {
  if (!canUseWindow()) return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
};

const isSecureOrLocalOrigin = (): boolean => {
  if (!canUseWindow()) return false;
  return (
    window.location.protocol === 'https:' ||
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname.toLowerCase())
  );
};

const canUseMetaMaskConnectTransport = (): boolean =>
  canUseWindow() && isSecureOrLocalOrigin() && isLikelyMobileWalletDevice();

const toMetaMaskConnectUniversalLink = (deeplink: string): string => {
  if (deeplink.startsWith(METAMASK_CONNECT_DEEPLINK_BASE)) {
    return `${METAMASK_CONNECT_UNIVERSAL_LINK_BASE}${deeplink.slice(
      METAMASK_CONNECT_DEEPLINK_BASE.length
    )}`;
  }
  return deeplink;
};

const openMetaMaskConnectLink = (deeplink: string): void => {
  if (!canUseWindow()) return;
  window.location.assign(toMetaMaskConnectUniversalLink(deeplink));
};

const parsePositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toHexChainId = (chainId: number): Hex => `0x${Math.floor(chainId).toString(16)}` as Hex;

const fromHexChainId = (chainId: unknown): number | null => {
  const normalized = String(chainId || '').trim();
  if (!normalized) return null;
  const parsed = normalized.startsWith('0x') ? parseInt(normalized, 16) : Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

const getConfiguredProviderWalletChainId = (): number => {
  return (
    parsePositiveInteger(import.meta.env.VITE_PROVIDER_WALLET_CHAIN_ID) ||
    DEFAULT_PROVIDER_WALLET_CHAIN_ID
  );
};

const getConfiguredRpcUrl = (chainId: number): string => {
  const explicitProviderRpcUrl = String(import.meta.env.VITE_PROVIDER_WALLET_RPC_URL || '').trim();
  if (explicitProviderRpcUrl) return explicitProviderRpcUrl;

  if (chainId === DEFAULT_PROVIDER_WALLET_CHAIN_ID) {
    return (
      String(import.meta.env.VITE_ETHEREUM_MAINNET_RPC_URL || '').trim() ||
      DEFAULT_ETHEREUM_MAINNET_RPC_URL
    );
  }

  return '';
};

const getSupportedNetworks = (): Record<Hex, string> => {
  const configuredChainId = getConfiguredProviderWalletChainId();
  const configuredRpcUrl = getConfiguredRpcUrl(configuredChainId);
  const networks: Record<Hex, string> = {
    [MAINNET_CHAIN_ID_HEX]: String(import.meta.env.VITE_ETHEREUM_MAINNET_RPC_URL || '').trim() ||
      DEFAULT_ETHEREUM_MAINNET_RPC_URL,
  };

  if (configuredRpcUrl) {
    networks[toHexChainId(configuredChainId)] = configuredRpcUrl;
  }

  return networks;
};

const getConnectChainIds = (): Hex[] => {
  const configuredChainId = getConfiguredProviderWalletChainId();
  const configuredChainIdHex = toHexChainId(configuredChainId);
  const networks = getSupportedNetworks();
  return networks[configuredChainIdHex] ? [configuredChainIdHex] : [MAINNET_CHAIN_ID_HEX];
};

const createMetaMaskConnectClient = async (): Promise<MetamaskConnectEVM> => {
  if (!metamaskConnectClientPromise) {
    metamaskConnectClientPromise = import('@metamask/connect-evm')
      .then(({ createEVMClient }) =>
        createEVMClient({
          dapp: {
            name: 'Higher Conscious Network',
            url: canUseWindow() ? window.location.origin : 'https://conscious-network.org',
            iconUrl: canUseWindow()
              ? new URL('/brand/higher-conscious-network-icon-512.png', window.location.origin).href
              : 'https://conscious-network.org/brand/higher-conscious-network-icon-512.png',
          },
          api: {
            supportedNetworks: getSupportedNetworks(),
          },
          analytics: {
            enabled: false,
          },
          ui: {
            preferExtension: false,
            showInstallModal: false,
            headless: true,
          },
          mobile: {
            useDeeplink: false,
            preferredOpenLink: openMetaMaskConnectLink,
          },
          eventHandlers: {
            connect: notifyWalletProviderUpdated,
            disconnect: notifyWalletProviderUpdated,
            accountsChanged: notifyWalletProviderUpdated,
            chainChanged: notifyWalletProviderUpdated,
          },
        })
      )
      .catch((error) => {
        metamaskConnectClientPromise = null;
        throw error;
      });
  }

  return metamaskConnectClientPromise;
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
  const isAndroid = isLikelyAndroidWalletDevice();
  const isIos = isLikelyIosWalletDevice();
  const isStandaloneApp = isStandaloneDisplayMode();
  const hasMetaMaskConnectTransport = canUseMetaMaskConnectTransport();
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
      canConnect: true,
      transport: 'injected',
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'metamask_mobile_browser',
      guidance: 'MetaMask browser is ready. Continue with the gasless wallet signature here.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (hasProvider && isMobile) {
    return {
      provider,
      providerName,
      hasProvider,
      canConnect: true,
      transport: 'injected',
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'mobile_provider_available',
      guidance: 'A wallet-enabled mobile browser is ready. Continue with the gasless wallet signature here.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (hasProvider) {
    return {
      provider,
      providerName,
      hasProvider,
      canConnect: true,
      transport: 'injected',
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

  if (hasMetaMaskConnectTransport) {
    return {
      provider,
      providerName: 'MetaMask',
      hasProvider,
      canConnect: true,
      transport: 'metamask_connect',
      isMobile,
      isStandaloneApp,
      isMetaMask: true,
      isMetaMaskMobileBrowser,
      state: 'mobile_metamask_connect_available',
      guidance: isIos
        ? 'Continue with the MetaMask app. iOS may ask you to switch back to HCN after approval so this session can finish.'
        : isStandaloneApp
          ? 'Continue with the MetaMask app. After approval, return to this installed HCN app if your phone does not switch back automatically.'
          : 'Continue with the MetaMask app. If MetaMask does not open, install or unlock it, then return to HCN and try again.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  if (isMobile) {
    return {
      provider,
      providerName,
      hasProvider,
      canConnect: false,
      transport: 'none',
      isMobile,
      isStandaloneApp,
      isMetaMask,
      isMetaMaskMobileBrowser,
      state: 'mobile_missing_provider',
      guidance: isSecureOrLocalOrigin()
        ? isIos
          ? 'Install MetaMask from the App Store, then return to HCN in Safari or the installed app and continue.'
          : isAndroid
            ? 'Install or unlock MetaMask Mobile, then return to HCN and continue.'
            : 'Install MetaMask Mobile or use a wallet-enabled browser, then return to HCN and continue.'
        : 'Open HCN over secure HTTPS, then retry MetaMask wallet verification.',
      actionLabel: null,
      deepLinkUrl,
    };
  }

  return {
    provider,
    providerName,
    hasProvider,
    canConnect: false,
    transport: 'none',
    isMobile,
    isStandaloneApp,
    isMetaMask,
    isMetaMaskMobileBrowser,
    state: 'desktop_missing_provider',
    guidance: 'Install or unlock the MetaMask browser extension for this desktop browser, then retry wallet verification. To use the mobile app, open HCN on your phone.',
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

const normalizeAccounts = (accounts: unknown): string[] => {
  if (!Array.isArray(accounts)) return [];
  return accounts.map((account) => String(account || '').trim()).filter(Boolean);
};

export const connectWalletProvider = async (): Promise<WalletConnection> => {
  const environment = detectWalletProviderEnvironment();

  if (environment.provider?.request) {
    const accounts = normalizeAccounts(
      await environment.provider.request({ method: 'eth_requestAccounts' })
    );
    const walletAddress = accounts[0] || '';
    if (!walletAddress) {
      throw new Error('No wallet address was returned by MetaMask.');
    }

    return {
      provider: environment.provider,
      accounts,
      walletAddress,
      chainId: await readWalletChainId(environment.provider).catch(() => null),
      transport: 'injected',
      environment,
    };
  }

  if (environment.transport === 'metamask_connect' && environment.canConnect) {
    const client = await createMetaMaskConnectClient();
    const result = await client.connect({
      chainIds: getConnectChainIds(),
      forceRequest: false,
    });
    const provider = client.getProvider();
    const accounts = normalizeAccounts(result.accounts);
    const walletAddress = accounts[0] || '';
    if (!walletAddress) {
      throw new Error('No wallet address was returned by MetaMask.');
    }

    return {
      provider,
      accounts,
      walletAddress,
      chainId: fromHexChainId(result.chainId),
      transport: 'metamask_connect',
      environment,
    };
  }

  throw new Error(environment.guidance);
};

export const readWalletChainId = async (provider: any): Promise<number | null> => {
  if (!provider?.request) return null;
  const rawChainId = await provider.request({ method: 'eth_chainId' });
  return fromHexChainId(rawChainId);
};
