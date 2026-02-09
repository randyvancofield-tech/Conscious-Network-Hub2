import { json } from "../lib/response.js";
import { createContext } from "../lib/context.js";
import { getEnv } from "../lib/env.js";
import { withHandler } from "../lib/handler.js";
import { authorize } from "../lib/auth.js";

export const onRequest = withHandler(async (context) => {
  const appContext = await createContext(context);
  getEnv(appContext);
  await authorize(appContext);
  return json({ success: true });
});
