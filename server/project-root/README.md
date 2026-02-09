# Cloudflare Pages Functions Scaffold

## Structure

```text
project-root/
  frontend/
    index.html
  functions/
    health.js
    auth.js
    api.js
  README.md
```

## How Pages Functions map to API routes

Cloudflare Pages automatically turns files in `/functions` into HTTP routes:

- `functions/health.js` -> `/health`
- `functions/auth.js` -> `/auth`
- `functions/api.js` -> `/api`

Each file exports an `async onRequest` handler. Cloudflare runs that handler when the matching route is requested.

## Deploy with Cloudflare Pages (Git integration)

1. Push this scaffold to a Git repository (for example GitHub).
2. In Cloudflare dashboard, open **Workers & Pages**.
3. Select **Create** -> **Pages** -> **Connect to Git**.
4. Choose your repository and branch.
5. Configure build settings:
   - Build command: none (or your frontend build command)
   - Build output directory: `frontend`
6. Deploy. Future pushes to the connected branch trigger automatic deployments.