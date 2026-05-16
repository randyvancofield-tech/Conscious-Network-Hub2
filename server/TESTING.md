# Backend Testing

This guide covers the current backend verification path. Most API routes are protected, so unauthenticated AI/social/upload calls should return `401`.

## Standard Checks

Run from the repository root:

```powershell
npm run check
```

That command runs:

- frontend production build
- backend TypeScript build
- backend Jest tests
- contract compilation

Run backend checks only from `server/`:

```powershell
npm run build
npm test
```

## Local Smoke Test

Start the backend first:

```powershell
npm run dev
```

Then, from `server/`, run:

```powershell
npm run test:smoke
```

Default smoke checks:

- `GET /health` returns `200`
- unauthenticated `POST /api/ai/chat` returns `401`
- `GET /api/membership/tiers` returns `200`
- empty `POST /api/user/create` returns `400`
- empty `POST /api/user/signin` returns `400`

To include a write-through auth flow against the configured database:

```powershell
$env:RUN_AUTH_FLOW="true"
npm run test:smoke
```

Auth smoke flow:

1. create user
2. read `/api/user/current`
3. logout
4. verify old token is rejected
5. sign in again

Optional smoke settings:

```powershell
$env:BASE_URL="http://localhost:3001"
$env:ORIGIN="http://localhost:5173"
```

## Jest Coverage

Current Jest suites cover:

- signin success and invalid credential behavior
- core user persistence loop
- privacy and social behavior

```powershell
npm test
```

## Manual Curl Examples

Health:

```powershell
curl.exe -sS http://localhost:3001/health
```

Membership tiers:

```powershell
curl.exe -sS http://localhost:3001/api/membership/tiers
```

Unauthenticated AI route should be rejected:

```powershell
curl.exe -sS -X POST http://localhost:3001/api/ai/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"Hello\"}"
```

Empty signup validation should fail:

```powershell
curl.exe -sS -X POST http://localhost:3001/api/user/create `
  -H "Content-Type: application/json" `
  -d "{}"
```

## Deployment Smoke Checks

For the current Render backend checks, use:

```powershell
npm run check:render
```

That script validates health, CORS, auth enforcement, membership tiers, signup/signin validation, and the production auth flow.

Legacy Cloud Run helpers remain in `package.json` for historical operations only; Render is the active backend deployment target.
