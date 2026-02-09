// Shared response helpers for Pages Functions live here so route files stay minimal and consistent.
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}
