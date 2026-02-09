/**
 * Cloudflare Pages Function: /health
 * Exports onRequest, which Cloudflare calls for incoming HTTP requests.
 */
export async function onRequest(context) {
  // Return a simple JSON health payload.
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}