import { error } from "./response.js";

export function withHandler(fn) {
  return async function wrappedHandler(context) {
    try {
      return await fn(context);
    } catch {
      return error("Internal Server Error", 500);
    }
  };
}
