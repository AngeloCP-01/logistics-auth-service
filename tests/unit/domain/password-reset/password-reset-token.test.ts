import { PasswordResetToken } from "@/domain/password-reset/password-reset-token.js";
import { ResetTokenId, UserId } from "@/domain/shared/ids.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const IN_15MIN = new Date("2026-05-21T10:15:00Z");

function issue(): PasswordResetToken {
  return PasswordResetToken.issue({
    id: ResetTokenId.generate(),
    userId: UserId.generate(),
    tokenHash: "h".repeat(64),
    expiresAt: IN_15MIN,
    now: NOW,
  });
}

describe("PasswordResetToken", () => {
  it("is issued usable", () => {
    const t = issue();
    expect(t.isUsable(NOW)).toBe(true);
    expect(t.usedAt).toBeNull();
  });

  it("becomes unusable after markUsed", () => {
    const t = issue();
    t.markUsed(NOW);
    expect(t.isUsable(NOW)).toBe(false);
    expect(t.usedAt).toEqual(NOW);
  });

  it("markUsed twice throws", () => {
    const t = issue();
    t.markUsed(NOW);
    expect(() => t.markUsed(NOW)).toThrow(/already used/i);
  });

  it("is unusable past expiry", () => {
    const t = issue();
    expect(t.isUsable(new Date("2026-05-21T10:15:01Z"))).toBe(false);
  });
});
