/**
 * Cloudflare Pages Function: /auth
 * Handles POST JSON input and echoes it back in a success response.
 */
export async function onRequest(context) {
  // Only allow POST for this demo auth endpoint.
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  try {
    // Parse JSON body sent by the client.
    const body = await context.request.json();

    return new Response(JSON.stringify({ success: true, body }), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    // Return a friendly message if request JSON is invalid.
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}