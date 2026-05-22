import type { NextFunction, Response } from "express";

import type { JwtVerifier } from "../../../infrastructure/jwt/jwt-verifier.js";

import type { AuthedRequest } from "./types.js";

export function jwtAuthMiddleware(verifier: JwtVerifier) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match) {
      const err = Object.assign(new Error("missing bearer"), {
        code: "unauthorized",
        status: 401,
      });
      next(err);
      return;
    }
    try {
      const claims = verifier.verify(match[1]!);
      req.auth = {
        userId: claims.sub,
        role: claims.role,
        emailVerified: claims.email_verified,
      };
      next();
    } catch {
      const err = Object.assign(new Error("invalid token"), {
        code: "unauthorized",
        status: 401,
      });
      next(err);
    }
  };
}
