# Provider Entry-Boundary Verification Prototype

This is a Phase 1 design note only. It does not change production member sign-in,
approved provider email/password sign-in, applicant sign-in, Stripe, Neon,
Cloudflare, Base44, pricing, or provider portal routing.

## Goal

Provider wallet verification, if enabled in a future phase, should happen only at
the Provider Access entry boundary. Once the backend creates the normal CNH user
session and native provider session, those existing sessions remain the authority
for provider tools. The portal must not repeatedly ask approved providers to sign
wallet messages after entry.

## On-Chain Data Boundary

`contracts/ProviderManager.sol` stores only wallet approval state:

- `mapping(address => bool) public approvedProviders`
- owner/admin wallet addresses
- wallet-only events with address and boolean fields

Do not store names, emails, license data, provider profile data, application
answers, PHI, meeting data, or user/member data on-chain.

## Future Backend Integration Points

Future Phase 2 can add isolated backend modules without wiring them into live
sign-in until explicitly approved:

1. `POST /api/provider/wallet/nonce`
   - Requires provider email or an already authenticated provider entry attempt.
   - Returns a short-lived nonce and EIP-712 typed-message payload.
   - Stores only a hashed nonce, expiry, and attempt counters off-chain.

2. `POST /api/provider/wallet/verify`
   - Accepts wallet address, signature, and nonce id.
   - Uses `ethers.verifyTypedData` or equivalent signature recovery.
   - Reads `ProviderManager.approvedProviders(wallet)` from the configured RPC.
   - Confirms the wallet is attached to the approved provider record in PostgreSQL.
   - Creates the existing CNH user session and native provider control session.

3. Provider session authority after entry
   - Existing signed user session remains the authenticated identity.
   - Existing native provider session remains the tool-unlock authority.
   - Existing provider role and active approval checks remain server-side.
   - Frontend route hiding remains usability only, never authorization.

## Gas Model

Providers only sign messages. They do not send blockchain transactions and do not
pay gas. CNH infrastructure/admin wallets pay gas only when adding, removing, or
batch-updating provider wallets on the private EVM network.

## Future Environment Values

These should remain unused until Phase 2 is approved:

- `PROVIDER_MANAGER_RPC_URL`
- `PROVIDER_MANAGER_CHAIN_ID`
- `PROVIDER_MANAGER_CONTRACT_ADDRESS`
- `PROVIDER_WALLET_VERIFICATION_ENABLED=false`

## Phase 2 Guardrails

- Do not add repeated wallet verification inside the Provider Portal.
- Do not block existing provider sessions with blockchain checks on every tool call.
- Do not make wallet verification a member sign-in dependency.
- Keep revocation server-side through existing provider access/session revocation,
  then mirror wallet removals to the contract as an admin operation.
