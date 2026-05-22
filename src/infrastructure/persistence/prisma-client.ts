import { PrismaClient } from "@prisma/client";

let cached: PrismaClient | null = null;

export function buildPrismaClient(url: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
}

/** Singleton used by long-lived processes (server.ts). Tests build their own. */
export function getPrismaClient(url: string): PrismaClient {
  if (!cached) cached = buildPrismaClient(url);
  return cached;
}
