export async function parseRequest(request) {
  const method = request.method;
  const contentType = request.headers.get("content-type") || "";
  let body = null;

  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  return { method, body };
}
