import type { PrismaClient } from "@prisma/client";
import type { PasswordResetToken } from "../../domain/password-reset/password-reset-token.js";
import type { PasswordResetTokenRepository } from "../../domain/password-reset/password-reset-token-repository.js";
import type { UserId } from "../../domain/shared/ids.js";
import { PasswordResetTokenMapper } from "./mappers/password-reset-token-mapper.js";
import { txOrPrisma } from "./prisma-unit-of-work.js";

export class PrismaPasswordResetTokenRepository
  implements PasswordResetTokenRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async byTokenHash(hash: string): Promise<PasswordResetToken | null> {
    const row = await txOrPrisma(this.prisma).passwordResetToken.findUnique({
      where: { tokenHash: hash },
    });
    return row ? PasswordResetTokenMapper.toDomain(row) : null;
  }

  async save(token: PasswordResetToken): Promise<void> {
    const data = PasswordResetTokenMapper.toPersistence(token);
    await txOrPrisma(this.prisma).passwordResetToken.upsert({
      where: { id: token.id },
      create: data,
      update: { usedAt: token.usedAt },
    });
  }

  async revokeUnusedForUser(userId: UserId, now: Date): Promise<void> {
    await txOrPrisma(this.prisma).passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
  }
}
