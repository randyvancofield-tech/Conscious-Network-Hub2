import { json } from "../lib/response.js";
import { withHandler } from "../lib/handler.js";

export const onRequest = withHandler(async ({ request }) => {
  const { pathname } = new URL(request.url);
  if (request.method === "GET" && pathname === "/api/ping") {
    return json({ ok: true, source: "cloudflare-worker", version: "ping-001" });
  }

  return json({ message: "API ready" });
});
