/**
 * Cloudflare Pages Function: /api
 * Demo endpoint that returns a static JSON message.
 */
export async function onRequest(context) {
  return new Response(JSON.stringify({ message: "This is a demo API endpoint" }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}