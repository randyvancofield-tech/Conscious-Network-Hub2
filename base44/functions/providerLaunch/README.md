# providerLaunch Base44 Function

This function starts the Base44 CRM to Conscious Network provider bridge.

## Required Base44 Secrets

Set these in Base44 before deploying the function:

- `BRIDGE_PROVIDER_SECRET`: must match the Cloud Run `BRIDGE_PROVIDER_SECRET`
- `BRIDGE_PROVIDER_ISSUER`: defaults to `base44-crm`
- `BRIDGE_PROVIDER_AUDIENCE`: defaults to `conscious-network-hub`
- `CONSCIOUS_BACKEND_URL`: defaults to `https://conscious-network.org`
- `CONSCIOUS_FRONTEND_URL`: defaults to `https://conscious-network.org`

## Flow

1. The Base44 frontend invokes `providerLaunch` with `{ action: "prepare" }`.
2. The function reads the authenticated Base44 user and `ProviderProfile`.
3. The function returns a wallet payload beginning with `Conscious Network Provider Launch`.
4. The frontend asks the provider wallet to sign that payload.
5. The frontend invokes `providerLaunch` again with `{ action: "launch", walletSignature, jti, scopes }`.
6. The function HMAC-signs the canonical bridge payload and posts to:
   `https://conscious-network.org/api/bridge/provider/issue-launch-code`
7. The function returns:
   `https://conscious-network.org/auth/callback?launchCode=pbl_...`
8. The frontend redirects the browser to that URL.

The wallet signature must be generated in the browser. A Base44 backend function can sign the HMAC assertion because it has access to secrets, but it cannot open a browser wallet prompt by itself.
