import { EmailVerificationToken } from "@/domain/email-verification/email-verification-token.js";
import { UserId, VerificationTokenId } from "@/domain/shared/ids.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const IN_24H = new Date("2026-05-22T10:00:00Z");

function issue(): EmailVerificationToken {
  return EmailVerificationToken.issue({
    id: VerificationTokenId.generate(),
    userId: UserId.generate(),
    tokenHash: "h".repeat(64),
    expiresAt: IN_24H,
    now: NOW,
  });
}

describe("EmailVerificationToken", () => {
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
    expect(t.isUsable(new Date("2026-05-22T10:00:01Z"))).toBe(false);
  });
});
