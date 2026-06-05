import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import {
  AccountLockedError,
  DomainError,
  RateLimitedError,
} from "../../../domain/shared/errors.js";
import { InfrastructureError } from "../../../infrastructure/shared/errors.js";
import { HttpError } from "../errors.js";

import type { AuthedRequest } from "./types.js";

interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  requestId?: string;
  errors?: Array<{ field: string; message: string }>;
}

function baseProblem(code: string, status: number, title: string): Problem {
  return {
    type: `https://logistics.example.com/problems/${code}`,
    title,
    status,
  };
}

export function errorMiddleware(
  req: Request,
  res: Response,
  err: unknown,
  _next: NextFunction,
): void {
  const requestId = (req as AuthedRequest).ctx?.requestId;

  if (err instanceof ZodError) {
    const p = baseProblem("validation_failed", 400, "Validation failed");
    p.errors = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    if (requestId) p.requestId = requestId;
    res.status(p.status).type("application/problem+json").json(p);
    return;
  }

  if (err instanceof DomainError) {
    const p = baseProblem(err.code, err.status, err.message);
    if (requestId) p.requestId = requestId;
    if (err instanceof AccountLockedError)
      res.setHeader("Retry-After", String(err.retryAfterSeconds));
    if (err instanceof RateLimitedError)
      res.setHeader("Retry-After", String(err.retryAfterSeconds));
    res.status(p.status).type("application/problem+json").json(p);
    return;
  }

  if (err instanceof HttpError) {
    const p = baseProblem(err.code, err.status, err.message);
    if (requestId) p.requestId = requestId;
    res.status(p.status).type("application/problem+json").json(p);
    return;
  }

  if (err instanceof InfrastructureError) {
    const p = baseProblem("internal_server_error", 500, "Internal Server Error");
    if (requestId) p.requestId = requestId;
    res.status(500).type("application/problem+json").json(p);
    return;
  }

  // Unknown — return 500. In non-production, surface the cause in the RESPONSE so a
  // 500 is debuggable without tailing logs. NEVER in production (leaks internals).
  const p = baseProblem("internal_server_error", 500, "Internal Server Error");
  if (requestId) p.requestId = requestId;
  const out: Record<string, unknown> = { ...p };
  if (process.env.NODE_ENV !== "production" && err instanceof Error) {
    out.detail = err.message;
    out.errorName = err.name;
    out.stack = err.stack?.split("\n").slice(1, 6).map((l) => l.trim());
  }
  res.status(500).type("application/problem+json").json(out);
}

// Express's error middleware needs the (err, req, res, next) signature.
// Some TS configs flag the parameter order; we re-export with the canonical shape:
export function errorMiddlewareExpress(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  errorMiddleware(req, res, err, next);
}
