import type { PrismaClient } from "@prisma/client";
import type { Response, Router } from "express";
import { Router as makeRouter } from "express";

export interface HealthControllerDeps {
  prisma: PrismaClient;
  /** Function that returns true if the RabbitMQ channel is currently open. */
  rabbitHealthy: () => boolean;
}

export function buildHealthRouter(deps: HealthControllerDeps): Router {
  const router = makeRouter();
  router.get("/healthz", (_req, res: Response) => {
    res.status(200).json({ status: "ok" });
  });
  router.get("/readyz", async (_req, res: Response) => {
    const checks: Record<string, "ok" | "fail"> = {
      db: "fail",
      rabbit: "fail",
    };
    try {
      await deps.prisma.$queryRawUnsafe("SELECT 1");
      checks.db = "ok";
    } catch {
      /* fall through */
    }
    checks.rabbit = deps.rabbitHealthy() ? "ok" : "fail";
    const allOk = Object.values(checks).every((c) => c === "ok");
    res
      .status(allOk ? 200 : 503)
      .json({ status: allOk ? "ready" : "not_ready", checks });
  });
  return router;
}
