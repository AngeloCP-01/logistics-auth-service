import type {
  Prisma,
  EmailVerificationToken as PrismaVerificationToken,
} from "@prisma/client";
import { EmailVerificationToken } from "../../../domain/email-verification/email-verification-token.js";
import { UserId, VerificationTokenId } from "../../../domain/shared/ids.js";

export const EmailVerificationTokenMapper = {
  toDomain(row: PrismaVerificationToken): EmailVerificationToken {
    return EmailVerificationToken.fromPersistence({
      id: VerificationTokenId.of(row.id),
      userId: UserId.of(row.userId),
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    });
  },
  toPersistence(
    t: EmailVerificationToken,
  ): Prisma.EmailVerificationTokenUncheckedCreateInput {
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
