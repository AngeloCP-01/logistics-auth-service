import type { NextFunction, Response } from "express";

import type { Role } from "../../../domain/user/role.js";

import type { AuthedRequest } from "./types.js";

export function requireRole(...allowed: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(
        Object.assign(new Error("missing auth"), {
          code: "unauthorized",
          status: 401,
        }),
      );
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      next(
        Object.assign(new Error("forbidden"), {
          code: "forbidden",
          status: 403,
        }),
      );
      return;
    }
    next();
  };
}
