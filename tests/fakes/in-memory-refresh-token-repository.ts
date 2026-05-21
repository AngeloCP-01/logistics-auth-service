import { RefreshToken } from "@/domain/refresh-token/refresh-token.js";
import type { RefreshTokenRepository } from "@/domain/refresh-token/refresh-token-repository.js";
import type { RefreshTokenId, UserId } from "@/domain/shared/ids.js";

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private byIdMap = new Map<string, RefreshToken>();
  private byHashMap = new Map<string, RefreshToken>();

  async byTokenHash(hash: string): Promise<RefreshToken | null> {
    return this.byHashMap.get(hash) ?? null;
  }
  async byId(id: RefreshTokenId): Promise<RefreshToken | null> {
    return this.byIdMap.get(id) ?? null;
  }
  async save(token: RefreshToken): Promise<void> {
    this.byIdMap.set(token.id, token);
    this.byHashMap.set(token.tokenHash, token);
  }
  async revokeFamilyForward(tokenId: RefreshTokenId, now: Date): Promise<void> {
    let cursor: RefreshToken | undefined = this.byIdMap.get(tokenId);
    while (cursor) {
      cursor.revokeAlone(now);
      const next: RefreshTokenId | null = cursor.replacedById;
      cursor = next ? this.byIdMap.get(next) : undefined;
    }
  }
  async revokeAllForUser(userId: UserId, now: Date): Promise<void> {
    for (const t of this.byIdMap.values()) {
      if (t.userId === userId && t.revokedAt === null) t.revokeAlone(now);
    }
  }
  all(): RefreshToken[] {
    return [...this.byIdMap.values()];
  }
}
