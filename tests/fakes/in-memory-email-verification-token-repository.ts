import type { EmailVerificationToken } from "@/domain/email-verification/email-verification-token.js";
import type { EmailVerificationTokenRepository } from "@/domain/email-verification/email-verification-token-repository.js";
import type { UserId } from "@/domain/shared/ids.js";

export class InMemoryEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  private byIdMap = new Map<string, EmailVerificationToken>();
  private byHashMap = new Map<string, EmailVerificationToken>();

  async byTokenHash(hash: string): Promise<EmailVerificationToken | null> {
    return this.byHashMap.get(hash) ?? null;
  }
  async save(token: EmailVerificationToken): Promise<void> {
    this.byIdMap.set(token.id, token);
    this.byHashMap.set(token.tokenHash, token);
  }
  async revokeUnusedForUser(userId: UserId, now: Date): Promise<void> {
    for (const t of this.byIdMap.values()) {
      if (t.userId === userId && t.usedAt === null) t.markUsed(now);
    }
  }
  all(): EmailVerificationToken[] {
    return [...this.byIdMap.values()];
  }
}
