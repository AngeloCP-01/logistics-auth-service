import type {
  Prisma,
  PasswordResetToken as PrismaResetToken,
} from "@prisma/client";
import { PasswordResetToken } from "../../../domain/password-reset/password-reset-token.js";
import { ResetTokenId, UserId } from "../../../domain/shared/ids.js";

export const PasswordResetTokenMapper = {
  toDomain(row: PrismaResetToken): PasswordResetToken {
    return PasswordResetToken.fromPersistence({
      id: ResetTokenId.of(row.id),
      userId: UserId.of(row.userId),
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    });
  },
  toPersistence(
    t: PasswordResetToken,
  ): Prisma.PasswordResetTokenUncheckedCreateInput {
    return {
      id: t.id,
      userId: t.userId,
      tokenHash: t.tokenHash,
      expiresAt: t.expiresAt,
      usedAt: t.usedAt,
      createdAt: t.createdAt,
    };
  },
};
