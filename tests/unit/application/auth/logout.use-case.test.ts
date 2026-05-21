import { LogoutUseCase } from "@/application/auth/logout.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import { RefreshToken } from "@/domain/refresh-token/refresh-token.js";
import { RefreshTokenId, UserId } from "@/domain/shared/ids.js";
import { InMemoryRefreshTokenRepository } from "@tests/fakes/in-memory-refresh-token-repository.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const FUTURE = new Date("2026-06-20T10:00:00Z");

function hashOf(raw: string): string {
  // The use-case must hash incoming raw with sha256; for unit tests we
  // bypass real hashing by storing a token whose tokenHash exactly equals raw.
  // The use-case must accept a TokenHasher port; we inject an identity hasher.
  return raw;
}

class IdentityTokenHasher {
  hash(raw: string): string {
    return raw;
  }
}

function makeSut() {
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokenHasher = new IdentityTokenHasher();
  const clock = new FixedClock(NOW);
  const sut = new LogoutUseCase(refreshTokens, tokenHasher as never, clock);
  return { sut, refreshTokens, clock };
}

describe("LogoutUseCase", () => {
  it("revokes the matching refresh token", async () => {
    const { sut, refreshTokens } = makeSut();
    const id = RefreshTokenId.generate();
    const token = RefreshToken.issue({
      id,
      userId: UserId.generate(),
      tokenHash: hashOf("raw-1"),
      expiresAt: FUTURE,
      ip: "1.1.1.1",
      userAgent: "ua",
      now: NOW,
    });
    await refreshTokens.save(token);

    await sut.execute({ refreshToken: "raw-1" });

    const updated = await refreshTokens.byId(id);
    expect(updated?.revokedAt).toEqual(NOW);
  });

  it("is idempotent — unknown token resolves without throwing", async () => {
    const { sut } = makeSut();
    await expect(
      sut.execute({ refreshToken: "missing" }),
    ).resolves.toBeUndefined();
  });

  it("is idempotent — already-revoked token resolves without throwing", async () => {
    const { sut, refreshTokens } = makeSut();
    const id = RefreshTokenId.generate();
    const token = RefreshToken.issue({
      id,
      userId: UserId.generate(),
      tokenHash: hashOf("raw-2"),
      expiresAt: FUTURE,
      ip: "x",
      userAgent: "ua",
      now: NOW,
    });
    token.revokeAlone(NOW);
    await refreshTokens.save(token);

    await expect(
      sut.execute({ refreshToken: "raw-2" }),
    ).resolves.toBeUndefined();
  });
});
