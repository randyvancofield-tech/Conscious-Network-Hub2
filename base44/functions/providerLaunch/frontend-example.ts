import { base44 } from "@/api/base44Client";

type ProviderLaunchPrepareResult = {
  walletPayload: string;
  jti: string;
  scopes: string[];
};

type ProviderLaunchResult = {
  redirectUrl: string;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export const launchConsciousNetworkProviderPortal = async (): Promise<void> => {
  const prepare = await base44.functions.invoke("providerLaunch", {
    action: "prepare",
  });
  const prepareData = prepare.data as ProviderLaunchPrepareResult;

  if (!window.ethereum) {
    throw new Error("Wallet provider is not available.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  }) as string[];
  const walletAddress = accounts[0];
  if (!walletAddress) {
    throw new Error("No wallet account selected.");
  }

  const walletSignature = await window.ethereum.request({
    method: "personal_sign",
    params: [prepareData.walletPayload, walletAddress],
  }) as string;

  const launch = await base44.functions.invoke("providerLaunch", {
    action: "launch",
    walletSignature,
    jti: prepareData.jti,
    scopes: prepareData.scopes,
  });
  const launchData = launch.data as ProviderLaunchResult;

  window.location.assign(launchData.redirectUrl);
};
