import { createClientFromRequest } from "npm:@base44/sdk";

const CONSCIOUS_BACKEND_URL =
  Deno.env.get("CONSCIOUS_BACKEND_URL") || "https://conscious-network.org";
const CONSCIOUS_FRONTEND_URL =
  Deno.env.get("CONSCIOUS_FRONTEND_URL") || "https://conscious-network.org";
const BRIDGE_PROVIDER_SECRET = Deno.env.get("BRIDGE_PROVIDER_SECRET") || "";
const BRIDGE_PROVIDER_ISSUER =
  Deno.env.get("BRIDGE_PROVIDER_ISSUER") || "base44-crm";
const BRIDGE_PROVIDER_AUDIENCE =
  Deno.env.get("BRIDGE_PROVIDER_AUDIENCE") || "conscious-network-hub";

const DEFAULT_SCOPES = ["provider:read", "provider:host"];
const APPROVED_STATUS = "approved";

type ProviderLaunchAction = "prepare" | "launch";

type ProviderLaunchRequest = {
  action?: ProviderLaunchAction;
  providerProfileId?: string;
  providerExternalId?: string;
  email?: string;
  name?: string;
  walletAddress?: string;
  walletDid?: string;
  walletSignature?: string;
  jti?: string;
  scopes?: string[];
};

type ProviderIdentity = {
  providerExternalId: string;
  email: string;
  name: string;
  walletAddress: string;
  walletDid: string;
  scopes: string[];
  jti: string;
};

const json = (body: unknown, init?: ResponseInit): Response =>
  Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers || {}),
    },
  });

const normalizeString = (value: unknown): string => String(value || "").trim();

const normalizeEmail = (value: unknown): string =>
  normalizeString(value).toLowerCase();

const normalizeScopes = (value: unknown): string[] => {
  const scopes = Array.isArray(value)
    ? value
        .filter((scope): scope is string => typeof scope === "string")
        .map((scope) => scope.trim().toLowerCase())
        .filter((scope) => /^provider:[a-z0-9:*_-]+$/.test(scope))
        .slice(0, 24)
    : [...DEFAULT_SCOPES];

  if (!scopes.includes("provider:read")) scopes.push("provider:read");
  if (!scopes.includes("provider:host")) scopes.push("provider:host");
  return Array.from(new Set(scopes)).sort();
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hmacSha256Hex = async (secret: string, payload: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
};

const canonicalWalletPayload = (input: ProviderIdentity): string =>
  [
    "Conscious Network Provider Launch",
    `aud=${BRIDGE_PROVIDER_AUDIENCE}`,
    `providerExternalId=${input.providerExternalId}`,
    `email=${input.email}`,
    `name=${input.name}`,
    "role=provider",
    `approvalStatus=${APPROVED_STATUS}`,
    `walletAddress=${input.walletAddress}`,
    `walletDid=${input.walletDid}`,
    `jti=${input.jti}`,
    `scopes=${input.scopes.join(",")}`,
  ].join("\n");

const canonicalBridgePayload = (
  input: ProviderIdentity,
  timestampMs: number,
): string =>
  [
    BRIDGE_PROVIDER_ISSUER,
    BRIDGE_PROVIDER_AUDIENCE,
    String(timestampMs),
    input.providerExternalId,
    input.email,
    input.name,
    "provider",
    APPROVED_STATUS,
    input.walletAddress,
    input.walletDid,
    input.jti,
    input.scopes.join(","),
  ].join("\n");

const readFirst = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
};

const getProviderProfile = async (
  base44: any,
  user: any,
  requestBody: ProviderLaunchRequest,
): Promise<any | null> => {
  const providerProfiles = base44.entities?.ProviderProfile;
  if (!providerProfiles) return null;

  if (requestBody.providerProfileId && providerProfiles.get) {
    return await providerProfiles.get(requestBody.providerProfileId);
  }

  if (providerProfiles.filter) {
    const byUserId = user?.id
      ? await providerProfiles.filter({ userId: user.id })
      : [];
    if (Array.isArray(byUserId) && byUserId[0]) return byUserId[0];

    const byEmail = user?.email
      ? await providerProfiles.filter({ email: normalizeEmail(user.email) })
      : [];
    if (Array.isArray(byEmail) && byEmail[0]) return byEmail[0];
  }

  return null;
};

const buildProviderIdentity = async (
  base44: any,
  user: any,
  requestBody: ProviderLaunchRequest,
): Promise<ProviderIdentity> => {
  const profile = await getProviderProfile(base44, user, requestBody);
  const providerExternalId = readFirst(
    requestBody.providerExternalId,
    profile?.providerExternalId,
    profile?.externalId,
    profile?.id,
    user?.id,
  );
  const email = normalizeEmail(
    readFirst(requestBody.email, profile?.email, user?.email),
  );
  const name = readFirst(
    requestBody.name,
    profile?.name,
    profile?.displayName,
    user?.full_name,
    user?.name,
    email.split("@")[0],
  );
  const walletAddress = readFirst(
    requestBody.walletAddress,
    profile?.walletAddress,
    profile?.wallet_address,
  );
  const walletDid = readFirst(
    requestBody.walletDid,
    profile?.walletDid,
    profile?.wallet_did,
  );
  const scopes = normalizeScopes(requestBody.scopes || profile?.scopes);
  const jti = readFirst(requestBody.jti, crypto.randomUUID());

  if (!providerExternalId || !email || !name || !walletAddress || !walletDid) {
    throw new Error(
      "Provider profile is missing providerExternalId, email, name, walletAddress, or walletDid.",
    );
  }

  return {
    providerExternalId,
    email,
    name,
    walletAddress,
    walletDid,
    scopes,
    jti,
  };
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!BRIDGE_PROVIDER_SECRET) {
      return json({ error: "Bridge provider secret is not configured" }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = (await req.json().catch(() => ({}))) as ProviderLaunchRequest;
    const identity = await buildProviderIdentity(base44, user, requestBody);
    const walletPayload = canonicalWalletPayload(identity);

    if ((requestBody.action || "prepare") === "prepare") {
      return json({
        success: true,
        action: "prepare",
        walletPayload,
        providerExternalId: identity.providerExternalId,
        email: identity.email,
        walletAddress: identity.walletAddress,
        walletDid: identity.walletDid,
        jti: identity.jti,
        aud: BRIDGE_PROVIDER_AUDIENCE,
        scopes: identity.scopes,
      });
    }

    const walletSignature = normalizeString(requestBody.walletSignature);
    if (!walletSignature) {
      return json({ error: "walletSignature is required for launch" }, { status: 400 });
    }

    const timestampMs = Date.now();
    const bridgePayload = canonicalBridgePayload(identity, timestampMs);
    const bridgeSignature = await hmacSha256Hex(
      BRIDGE_PROVIDER_SECRET,
      bridgePayload,
    );

    const response = await fetch(
      `${CONSCIOUS_BACKEND_URL.replace(/\/+$/, "")}/api/bridge/provider/issue-launch-code`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bridge-Issuer": BRIDGE_PROVIDER_ISSUER,
          "X-Bridge-Timestamp": String(timestampMs),
          "X-Bridge-Signature": bridgeSignature,
          "X-Bridge-Key-Id": "base44-provider-launch",
        },
        body: JSON.stringify({
          providerExternalId: identity.providerExternalId,
          email: identity.email,
          name: identity.name,
          role: "provider",
          approvalStatus: APPROVED_STATUS,
          providerApproved: true,
          walletAddress: identity.walletAddress,
          walletDid: identity.walletDid,
          walletSignature,
          jti: identity.jti,
          aud: BRIDGE_PROVIDER_AUDIENCE,
          scopes: identity.scopes,
        }),
      },
    );

    const responseBody = await response.json().catch(() => null);
    if (!response.ok || !responseBody?.launchCode) {
      return json(
        {
          error: "Conscious Network provider launch failed",
          status: response.status,
          detail: responseBody,
        },
        { status: response.status || 502 },
      );
    }

    const redirectUrl =
      `${CONSCIOUS_FRONTEND_URL.replace(/\/+$/, "")}/auth/callback?launchCode=${
        encodeURIComponent(responseBody.launchCode)
      }`;

    return json({
      success: true,
      launchCode: responseBody.launchCode,
      expiresAt: responseBody.expiresAt,
      redirectUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider launch failed";
    return json({ error: message }, { status: 500 });
  }
});
