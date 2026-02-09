import { json } from "../lib/response.js";
import { withHandler } from "../lib/handler.js";

export const onRequest = withHandler(async () => {
  return json({ status: "ok" });
});
