import { RotateRefreshTokenUseCase } from "@/application/auth/rotate-refresh-token.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import { TokenExpiredError, TokenReusedError } from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { RefreshTokenId, UserId } from "@/domain/shared/ids.js";
import { RefreshToken } from "@/domain/refresh-token/refresh-token.js";
import { User } from "@/domain/user/user.js";
import { FakeAccessTokenIssuer } from "@tests/fakes/fake-access-token-issuer.js";
import { FakeTokenGenerator } from "@tests/fakes/fake-token-generator.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryRefreshTokenRepository } from "@tests/fakes/in-memory-refresh-token-repository.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const FUTURE = new Date("2026-06-20T10:00:00Z");

class IdentityTokenHasher {
  hash(raw: string): string {
    return raw;
  }
}

async function seedUser(users: InMemoryUserRepository): Promise<UserId> {
  const id = UserId.generate();
  await users.save(
    User.fromPersistence({
      id,
      email: Email.of("u@b.com"),
      passwordHash: HashedPassword.fromHash("$argon2id$fake$x"),
      role: "customer",
      status: "active",
      emailVerifiedAt: null,
      createdAt: NOW,
    }),
  );
  return id;
}

function makeSut() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokenGen = new FakeTokenGenerator();
  const tokenHasher = new IdentityTokenHasher();
  const accessTokens = new FakeAccessTokenIssuer();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  const sut = new RotateRefreshTokenUseCase(
    users,
    refreshTokens,
    tokenGen,
    tokenHasher as never,
    accessTokens,
    clock,
    uow,
    { refreshTtlDays: 30 },
  );
  return { sut, users, refreshTokens, tokenGen, accessTokens, clock };
}

describe("RotateRefreshTokenUseCase", () => {
  it("happy path: revokes old, issues new pair, links replaced_by_id", async () => {
    const { sut, users, refreshTokens } = makeSut();
    const userId = await seedUser(users);
    const oldId = RefreshTokenId.generate();
    await refreshTokens.save(
      RefreshToken.issue({
        id: oldId,
        userId,
        tokenHash: "raw-old",
        expiresAt: FUTURE,
        ip: "1.1.1.1",
        userAgent: "ua",
        now: NOW,
      }),
    );

    const out = await sut.execute({
      refreshToken: "raw-old",
      ip: "2.2.2.2",
      userAgent: "ua2",
    });

    expect(out.accessToken).toMatch(/^access\./);
    expect(out.refreshToken).not.toBe("raw-old");
    const oldRow = await refreshTokens.byId(oldId);
    expect(oldRow?.revokedAt).toEqual(NOW);
    expect(oldRow?.replacedById).toBeDefined();
  });

  it("throws TokenExpiredError on unknown token", async () => {
    const { sut } = makeSut();
    await expect(
      sut.execute({ refreshToken: "missing", ip: "x", userAgent: "y" }),
    ).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("throws TokenExpiredError when token past expiry", async () => {
    const { sut, users, refreshTokens, clock } = makeSut();
    const userId = await seedUser(users);
    await refreshTokens.save(
      RefreshToken.issue({
        id: RefreshTokenId.generate(),
        userId,
        tokenHash: "raw-exp",
        expiresAt: new Date("2026-05-20T00:00:00Z"),
        ip: "x",
        userAgent: "y",
        now: new Date("2026-04-20T00:00:00Z"),
      }),
    );
    void clock;
    await expect(
      sut.execute({ refreshToken: "raw-exp", ip: "x", userAgent: "y" }),
    ).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("reuse: a revoked token triggers TokenReusedError AND revokes the family forward", async () => {
    const { sut, users, refreshTokens } = makeSut();
    const userId = await seedUser(users);

    // Build a chain of 3 tokens (A -> B -> C). A and B are revoked (already rotated).
    // C is the current head.
    const idA = RefreshTokenId.generate();
    const idB = RefreshTokenId.generate();
    const idC = RefreshTokenId.generate();
    const a = RefreshToken.fromPersistence({
      id: idA,
      userId,
      tokenHash: "raw-A",
      expiresAt: FUTURE,
      revokedAt: new Date("2026-05-21T09:50:00Z"),
      replacedById: idB,
      createdFromIp: "x",
      userAgent: "y",
      createdAt: NOW,
    });
    const b = RefreshToken.fromPersistence({
      id: idB,
      userId,
      tokenHash: "raw-B",
      expiresAt: FUTURE,
      revokedAt: new Date("2026-05-21T09:55:00Z"),
      replacedById: idC,
      createdFromIp: "x",
      userAgent: "y",
      createdAt: NOW,
    });
    const c = RefreshToken.fromPersistence({
      id: idC,
      userId,
      tokenHash: "raw-C",
      expiresAt: FUTURE,
      revokedAt: null,
      replacedById: null,
      createdFromIp: "x",
      userAgent: "y",
      createdAt: NOW,
    });
    await refreshTokens.save(a);
    await refreshTokens.save(b);
    await refreshTokens.save(c);

    // Attacker presents the old (revoked) A.
    await expect(
      sut.execute({ refreshToken: "raw-A", ip: "z", userAgent: "z" }),
    ).rejects.toBeInstanceOf(TokenReusedError);

    // Family walk: A, B were already revoked; C must now be revoked too.
    const cAfter = await refreshTokens.byId(idC);
    expect(cAfter?.revokedAt).toEqual(NOW);
  });
});
