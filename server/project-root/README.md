# Cloudflare Pages Scaffold

This scaffold is configured for a static frontend with dynamic backend endpoints using **Cloudflare Pages Functions**.

## Structure

```text
project-root/
  frontend/
    index.html
  functions/
    health.js
    auth.js
    api.js
  package.json
  README.md
```

## How It Works

- `frontend/index.html`: static site entry point. Includes a script that calls `/health`.
- `functions/health.js`: `onRequest` returns `{ "status": "ok" }`.
- `functions/auth.js`: accepts `POST` JSON and returns `{ success: true, body }`.
- `functions/api.js`: returns `{ "message": "This is a demo API endpoint" }`.

Cloudflare Pages maps files in `functions/` to routes:
- `functions/health.js` -> `/health`
- `functions/auth.js` -> `/auth`
- `functions/api.js` -> `/api`

## Deploy From GitHub

1. Push this scaffold to a GitHub repository.
2. In Cloudflare Dashboard, go to **Workers & Pages**.
3. Click **Create** -> **Pages** -> **Connect to Git**.
4. Select your GitHub repo and authorize Cloudflare access.
5. Configure build settings:
   - Framework preset: `None` (or your chosen frontend framework)
   - Build command: `npm run build`
   - Build output directory: `frontend`
6. Save and deploy.

## Enable Cloudflare Pages Functions

- Pages Functions are enabled when a `functions/` directory exists in your project.
- Keep `functions` at the project root (same level as `frontend`) so Cloudflare can detect routes.

## Push And Trigger Deployment

1. Commit your scaffold:
   - `git add .`
   - `git commit -m "Add Cloudflare Pages scaffold"`
2. Push to your connected branch (for example `main`):
   - `git push origin main`
3. Cloudflare Pages will automatically start a new deployment.

## Example cURL Requests

```bash
curl https://<your-pages-domain>/health
curl https://<your-pages-domain>/api
curl -X POST https://<your-pages-domain>/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","token":"demo-token"}'
```

## Local Dev Note

Use Cloudflare's local dev workflow (for example via Wrangler) as documented by Cloudflare Pages. The scaffold's `npm run dev` script is intentionally a placeholder.