import type {
  Prisma,
  RefreshToken as PrismaRefreshToken,
} from "@prisma/client";
import { RefreshToken } from "../../../domain/refresh-token/refresh-token.js";
import { RefreshTokenId, UserId } from "../../../domain/shared/ids.js";

export const RefreshTokenMapper = {
  toDomain(row: PrismaRefreshToken): RefreshToken {
    return RefreshToken.fromPersistence({
      id: RefreshTokenId.of(row.id),
      userId: UserId.of(row.userId),
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      replacedById: row.replacedById
        ? RefreshTokenId.of(row.replacedById)
        : null,
      createdFromIp: row.createdFromIp,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    });
  },
  toPersistence(t: RefreshToken): Prisma.RefreshTokenUncheckedCreateInput {
    return {
      id: t.id,
      userId: t.userId,
      tokenHash: t.tokenHash,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      replacedById: t.replacedById,
      createdFromIp: t.createdFromIp,
      userAgent: t.userAgent,
      createdAt: t.createdAt,
    };
  },
};
