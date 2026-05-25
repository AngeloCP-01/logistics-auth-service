import type { NextFunction, Response } from "express";

import type { Role } from "../../../domain/user/role.js";
import { HttpError } from "../errors.js";

import type { AuthedRequest } from "./types.js";

export function requireRole(...allowed: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, "unauthorized", "missing auth"));
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      next(new HttpError(403, "forbidden", "forbidden"));
      return;
    }
    next();
  };
}
