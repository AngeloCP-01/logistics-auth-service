import type { PrismaClient } from "@prisma/client";
import type { EmailVerificationToken } from "../../domain/email-verification/email-verification-token.js";
import type { EmailVerificationTokenRepository } from "../../domain/email-verification/email-verification-token-repository.js";
import type { UserId } from "../../domain/shared/ids.js";
import { EmailVerificationTokenMapper } from "./mappers/email-verification-token-mapper.js";
import { txOrPrisma } from "./prisma-unit-of-work.js";

export class PrismaEmailVerificationTokenRepository
  implements EmailVerificationTokenRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async byTokenHash(hash: string): Promise<EmailVerificationToken | null> {
    const row = await txOrPrisma(this.prisma).emailVerificationToken.findUnique(
      { where: { tokenHash: hash } },
    );
    return row ? EmailVerificationTokenMapper.toDomain(row) : null;
  }

  async save(token: EmailVerificationToken): Promise<void> {
    const data = EmailVerificationTokenMapper.toPersistence(token);
    await txOrPrisma(this.prisma).emailVerificationToken.upsert({
      where: { id: token.id },
      create: data,
      update: { usedAt: token.usedAt },
    });
  }

  async revokeUnusedForUser(userId: UserId, now: Date): Promise<void> {
    await txOrPrisma(this.prisma).emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
  }
}
