import { onRequest as healthHandler } from "./functions/health.js";
import { onRequest as authHandler } from "./functions/auth.js";
import { onRequest as apiHandler } from "./functions/api.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/health") {
      return healthHandler({ request, env });
    }

    if (pathname === "/auth") {
      return authHandler({ request, env });
    }

    if (pathname === "/api") {
      return apiHandler({ request, env });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }
};
