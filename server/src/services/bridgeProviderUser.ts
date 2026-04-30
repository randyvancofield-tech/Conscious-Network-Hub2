import crypto from 'crypto';
import { ethers } from 'ethers';
import { hashPassword } from '../auth';
import { localStore } from './persistenceStore';

const DEFAULT_PROVIDER_TIER = 'Accelerated Tier';

type BridgeRole = 'provider' | 'admin';

const normalizeEmail = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const normalizeOptionalString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeWalletAddress = (value: unknown): string | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  try {
    return ethers.getAddress(normalized);
  } catch {
    return null;
  }
};

export const toBridgePublicUser = (
  user: Awaited<ReturnType<typeof localStore.getUserById>>
) => ({
  id: user?.id || '',
  email: user?.email || '',
  name: user?.name || 'Provider',
  role: user?.role || 'user',
  providerExternalId: user?.providerExternalId || null,
  tier: user?.tier || null,
  subscriptionStatus: user?.subscriptionStatus || 'inactive',
  createdAt: user?.createdAt || new Date(),
  updatedAt: user?.updatedAt || new Date(),
  twoFactorEnabled: user?.twoFactorMethod ? user.twoFactorMethod !== 'none' : false,
  twoFactorMethod: user?.twoFactorMethod || 'none',
  phoneNumberMasked: null,
  walletAddress: user?.walletAddress || null,
  walletDid: user?.walletDid || null,
});

export const upsertBridgeProviderUser = async (input: {
  providerExternalId: string;
  email: string;
  name?: string | null;
  role?: BridgeRole;
  walletAddress?: string | null;
  walletDid?: string | null;
}): Promise<Awaited<ReturnType<typeof localStore.getUserById>>> => {
  const normalizedExternalId = String(input.providerExternalId || '').trim();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedName =
    normalizeOptionalString(input.name) || normalizedEmail.split('@')[0] || 'Provider';
  const normalizedWalletAddress = normalizeWalletAddress(input.walletAddress);
  const normalizedWalletDid = normalizeOptionalString(input.walletDid);
  const requestedRole: BridgeRole = input.role === 'admin' ? 'admin' : 'provider';

  const byExternalId = await localStore.getUserByProviderExternalId(normalizedExternalId);
  const byEmail = await localStore.getUserByEmail(normalizedEmail);

  if (byExternalId && byEmail && byExternalId.id !== byEmail.id) {
    throw new Error('Bridge identity conflict: providerExternalId/email mismatch');
  }

  const target = byExternalId || byEmail;
  if (!target) {
    const generatedPassword = hashPassword(crypto.randomBytes(32).toString('hex'));
    return localStore.createUser({
      email: normalizedEmail,
      name: normalizedName,
      password: generatedPassword,
      tier: DEFAULT_PROVIDER_TIER,
      role: requestedRole,
      providerExternalId: normalizedExternalId,
      twoFactorMethod: 'none',
      walletAddress: normalizedWalletAddress,
      walletDid: normalizedWalletDid,
    });
  }

  const updated = await localStore.updateUser(target.id, {
    name: normalizedName,
    role: requestedRole === 'admin' || target.role === 'admin' ? 'admin' : 'provider',
    providerExternalId: normalizedExternalId,
    tier: target.tier || DEFAULT_PROVIDER_TIER,
    ...(normalizedWalletAddress ? { walletAddress: normalizedWalletAddress } : {}),
    ...(normalizedWalletDid ? { walletDid: normalizedWalletDid } : {}),
  });

  return updated || target;
};
