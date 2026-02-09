import { parseRequest } from "./request.js";

export async function createContext({ request }) {
  const { method, body } = await parseRequest(request);
  return { request, method, body };
}
