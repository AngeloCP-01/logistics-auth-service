import { LoginUseCase } from "@/application/auth/login.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import {
  AccountLockedError,
  InvalidCredentialsError,
} from "@/domain/shared/errors.js";
import { UserId } from "@/domain/shared/ids.js";
import { Email } from "@/domain/shared/email.js";
import { User } from "@/domain/user/user.js";
import { FakeAccessTokenIssuer } from "@tests/fakes/fake-access-token-issuer.js";
import { FakePasswordHasher } from "@tests/fakes/fake-password-hasher.js";
import { FakeTokenGenerator } from "@tests/fakes/fake-token-generator.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryRateLimiter } from "@tests/fakes/in-memory-rate-limiter.js";
import { InMemoryRefreshTokenRepository } from "@tests/fakes/in-memory-refresh-token-repository.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const REFRESH_TTL_DAYS = 30;

async function seedUser(
  users: InMemoryUserRepository,
  email: string,
  plaintext: string,
): Promise<UserId> {
  const hasher = new FakePasswordHasher();
  const id = UserId.generate();
  const user = User.fromPersistence({
    id,
    email: Email.of(email),
    passwordHash: await hasher.hash(plaintext),
    role: "customer",
    status: "active",
    emailVerifiedAt: null,
    createdAt: NOW,
  });
  await users.save(user);
  return id;
}

function makeSut() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const hasher = new FakePasswordHasher();
  const tokenGen = new FakeTokenGenerator();
  const rateLimiter = new InMemoryRateLimiter();
  const accessTokens = new FakeAccessTokenIssuer();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  const sut = new LoginUseCase(
    users,
    refreshTokens,
    hasher,
    tokenGen,
    rateLimiter,
    accessTokens,
    clock,
    uow,
    {
      refreshTtlDays: REFRESH_TTL_DAYS,
      lockoutThreshold: 5,
      lockoutWindowSeconds: 900,
    },
  );
  return {
    sut,
    users,
    refreshTokens,
    hasher,
    rateLimiter,
    accessTokens,
    clock,
  };
}

describe("LoginUseCase", () => {
  it("issues a token pair on success and clears counters", async () => {
    const { sut, users, refreshTokens, rateLimiter } = makeSut();
    await seedUser(users, "a@b.com", "secret123");
    await rateLimiter.recordFailure("lockout:email:a@b.com", 900);

    const result = await sut.execute({
      email: "a@b.com",
      password: "secret123",
      ip: "1.2.3.4",
      userAgent: "ua",
    });

    expect(result.accessToken).toMatch(/^access\./);
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(900);
    expect(result.tokenType).toBe("Bearer");
    expect(refreshTokens.all()).toHaveLength(1);
    expect(await rateLimiter.getCount("lockout:email:a@b.com")).toBe(0);
  });

  it("throws InvalidCredentialsError on unknown email AND calls sentinel verify (timing parity)", async () => {
    const { sut, hasher } = makeSut();
    await expect(
      sut.execute({
        email: "nope@b.com",
        password: "x",
        ip: "1.1.1.1",
        userAgent: "ua",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.sentinelVerifications).toBe(1);
  });

  it("throws InvalidCredentialsError on wrong password and increments both counters", async () => {
    const { sut, users, rateLimiter } = makeSut();
    await seedUser(users, "a@b.com", "secret123");
    await expect(
      sut.execute({
        email: "a@b.com",
        password: "wrong",
        ip: "1.2.3.4",
        userAgent: "ua",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(await rateLimiter.getCount("lockout:email:a@b.com")).toBe(1);
    expect(await rateLimiter.getCount("lockout:ip:1.2.3.4")).toBe(1);
  });

  it("throws InvalidCredentialsError on disabled user (no leak)", async () => {
    const { sut, users } = makeSut();
    const id = UserId.generate();
    const hasher = new FakePasswordHasher();
    const u = User.fromPersistence({
      id,
      email: Email.of("d@b.com"),
      passwordHash: await hasher.hash("ok"),
      role: "customer",
      status: "disabled",
      emailVerifiedAt: null,
      createdAt: NOW,
    });
    await users.save(u);
    await expect(
      sut.execute({
        email: "d@b.com",
        password: "ok",
        ip: "1.1.1.1",
        userAgent: "ua",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws AccountLockedError when per-email counter is at threshold", async () => {
    const { sut, users, rateLimiter } = makeSut();
    await seedUser(users, "a@b.com", "secret123");
    for (let i = 0; i < 5; i++)
      await rateLimiter.recordFailure("lockout:email:a@b.com", 900);

    await expect(
      sut.execute({
        email: "a@b.com",
        password: "secret123",
        ip: "1.2.3.4",
        userAgent: "ua",
      }),
    ).rejects.toBeInstanceOf(AccountLockedError);
  });

  it("throws AccountLockedError when per-IP counter is at threshold", async () => {
    const { sut, users, rateLimiter } = makeSut();
    await seedUser(users, "a@b.com", "secret123");
    for (let i = 0; i < 5; i++)
      await rateLimiter.recordFailure("lockout:ip:1.2.3.4", 900);

    await expect(
      sut.execute({
        email: "a@b.com",
        password: "secret123",
        ip: "1.2.3.4",
        userAgent: "ua",
      }),
    ).rejects.toBeInstanceOf(AccountLockedError);
  });
});
