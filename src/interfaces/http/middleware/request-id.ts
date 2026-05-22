import { randomUUID } from "node:crypto";

import type { NextFunction, Response } from "express";

import type { AuthedRequest } from "./types.js";

export function requestIdMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header("x-request-id");
  const requestId =
    incoming && /^[A-Za-z0-9-]{8,128}$/.test(incoming)
      ? incoming
      : randomUUID();
  const ip = String(
    req.header("x-forwarded-for") ?? req.socket.remoteAddress ?? "0.0.0.0",
  )
    .split(",")[0]!
    .trim();
  const userAgent = String(req.header("user-agent") ?? "");
  req.ctx = { requestId, ip, userAgent };
  res.setHeader("x-request-id", requestId);
  next();
}
