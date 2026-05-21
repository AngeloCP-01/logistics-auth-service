import { RefreshToken } from "@/domain/refresh-token/refresh-token.js";
import { RefreshTokenId, UserId } from "@/domain/shared/ids.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const FUTURE = new Date("2026-06-20T10:00:00Z");

function issue(): RefreshToken {
  return RefreshToken.issue({
    id: RefreshTokenId.generate(),
    userId: UserId.generate(),
    tokenHash: "h".repeat(64),
    expiresAt: FUTURE,
    ip: "10.0.0.1",
    userAgent: "Jest/1",
    now: NOW,
  });
}

describe("RefreshToken", () => {
  it("is issued in usable state", () => {
    const t = issue();
    expect(t.isUsable(NOW)).toBe(true);
    expect(t.revokedAt).toBeNull();
    expect(t.replacedById).toBeNull();
  });

  it("is unusable past expiry", () => {
    const t = issue();
    expect(t.isUsable(new Date("2026-07-01T00:00:00Z"))).toBe(false);
  });

  it("is unusable once revoked", () => {
    const t = issue();
    t.revokeAlone(NOW);
    expect(t.isUsable(NOW)).toBe(false);
    expect(t.revokedAt).toEqual(NOW);
  });

  it("revokeAlone is idempotent (does not overwrite earlier revoke)", () => {
    const t = issue();
    t.revokeAlone(NOW);
    const later = new Date("2026-05-21T12:00:00Z");
    t.revokeAlone(later);
    expect(t.revokedAt).toEqual(NOW);
  });

  describe("rotate", () => {
    it("revokes self, links replaced_by_id, and returns next token", () => {
      const old = issue();
      const result = old.rotate({
        newId: RefreshTokenId.generate(),
        newHash: "n".repeat(64),
        newExpiresAt: FUTURE,
        ip: "10.0.0.2",
        userAgent: "Jest/2",
        now: NOW,
      });
      expect(old.revokedAt).toEqual(NOW);
      expect(old.replacedById).toEqual(result.next.id);
      expect(result.next.isUsable(NOW)).toBe(true);
      expect(result.next.userId).toEqual(old.userId);
    });

    it("throws when rotating an already-revoked token", () => {
      const old = issue();
      old.revokeAlone(NOW);
      expect(() =>
        old.rotate({
          newId: RefreshTokenId.generate(),
          newHash: "n".repeat(64),
          newExpiresAt: FUTURE,
          ip: "x",
          userAgent: "y",
          now: NOW,
        }),
      ).toThrow(/already revoked/i);
    });
  });
});
