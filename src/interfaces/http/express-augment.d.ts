import type { AuthContext, RequestContext } from "./middleware/types.js";

declare global {
  namespace Express {
    interface Request {
      ctx: RequestContext;
      auth?: AuthContext;
    }
  }
}

export {};
