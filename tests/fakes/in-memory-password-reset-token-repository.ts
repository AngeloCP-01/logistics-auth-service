import type { PasswordResetToken } from "@/domain/password-reset/password-reset-token.js";
import type { PasswordResetTokenRepository } from "@/domain/password-reset/password-reset-token-repository.js";
import type { UserId } from "@/domain/shared/ids.js";

export class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
  private byIdMap = new Map<string, PasswordResetToken>();
  private byHashMap = new Map<string, PasswordResetToken>();

  async byTokenHash(hash: string): Promise<PasswordResetToken | null> {
    return this.byHashMap.get(hash) ?? null;
  }
  async save(token: PasswordResetToken): Promise<void> {
    this.byIdMap.set(token.id, token);
    this.byHashMap.set(token.tokenHash, token);
  }
  async revokeUnusedForUser(userId: UserId, now: Date): Promise<void> {
    for (const t of this.byIdMap.values()) {
      if (t.userId === userId && t.usedAt === null) t.markUsed(now);
    }
  }
  all(): PasswordResetToken[] {
    return [...this.byIdMap.values()];
  }
}
