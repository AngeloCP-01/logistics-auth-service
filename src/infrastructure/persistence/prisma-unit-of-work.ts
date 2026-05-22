import type { PrismaClient, Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
import type { UnitOfWork } from "../../application/ports/unit-of-work.js";

/**
 * AsyncLocalStorage holding the current Prisma transaction client.
 * Repository methods read this via `txOrPrisma(prisma)` to participate
 * in the active transaction when present.
 */
export const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export function txOrPrisma(
  prisma: PrismaClient,
): PrismaClient | Prisma.TransactionClient {
  return txStorage.getStore() ?? prisma;
}

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (txStorage.getStore()) {
      // Nested call — just run within the existing transaction.
      return fn();
    }
    return this.prisma.$transaction(async (tx) => {
      return txStorage.run(tx, () => fn());
    });
  }
}
