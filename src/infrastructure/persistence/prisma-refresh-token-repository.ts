import type {
  PrismaClient,
  RefreshToken as PrismaRefreshToken,
} from "@prisma/client";
import type { RefreshToken } from "../../domain/refresh-token/refresh-token.js";
import type { RefreshTokenRepository } from "../../domain/refresh-token/refresh-token-repository.js";
import type { RefreshTokenId, UserId } from "../../domain/shared/ids.js";
import { RefreshTokenMapper } from "./mappers/refresh-token-mapper.js";
import { txOrPrisma } from "./prisma-unit-of-work.js";

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async byTokenHash(hash: string): Promise<RefreshToken | null> {
    const row = await txOrPrisma(this.prisma).refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    return row ? RefreshTokenMapper.toDomain(row) : null;
  }

  async byId(id: RefreshTokenId): Promise<RefreshToken | null> {
    const row = await txOrPrisma(this.prisma).refreshToken.findUnique({
      where: { id },
    });
    return row ? RefreshTokenMapper.toDomain(row) : null;
  }

  async save(token: RefreshToken): Promise<void> {
    const data = RefreshTokenMapper.toPersistence(token);
    await txOrPrisma(this.prisma).refreshToken.upsert({
      where: { id: token.id },
      create: data,
      update: {
        revokedAt: token.revokedAt,
        replacedById: token.replacedById,
      },
    });
  }

  async revokeFamilyForward(tokenId: RefreshTokenId, now: Date): Promise<void> {
    const client = txOrPrisma(this.prisma);
    let cursorId: string | null = tokenId;
    const seen = new Set<string>();
    while (cursorId && !seen.has(cursorId)) {
      seen.add(cursorId);
      const row: PrismaRefreshToken | null =
        await client.refreshToken.findUnique({
          where: { id: cursorId },
        });
      if (!row) break;
      if (row.revokedAt === null) {
        await client.refreshToken.update({
          where: { id: cursorId },
          data: { revokedAt: now },
        });
      }
      cursorId = row.replacedById;
    }
  }

  async revokeAllForUser(userId: UserId, now: Date): Promise<void> {
    await txOrPrisma(this.prisma).refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
