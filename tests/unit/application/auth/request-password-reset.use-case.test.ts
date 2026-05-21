import { RequestPasswordResetUseCase } from "@/application/auth/request-password-reset.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import { RateLimitedError } from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import { PasswordResetRequested } from "@/domain/user/events.js";
import { FakeTokenGenerator } from "@tests/fakes/fake-token-generator.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryPasswordResetTokenRepository } from "@tests/fakes/in-memory-password-reset-token-repository.js";
import { InMemoryRateLimiter } from "@tests/fakes/in-memory-rate-limiter.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";
import { RecordingEventBus } from "@tests/fakes/recording-event-bus.js";

const NOW = new Date("2026-05-21T10:00:00Z");

async function seedUser(
  users: InMemoryUserRepository,
  email: string,
): Promise<UserId> {
  const id = UserId.generate();
  await users.save(
    User.fromPersistence({
      id,
      email: Email.of(email),
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
  const resetTokens = new InMemoryPasswordResetTokenRepository();
  const tokenGen = new FakeTokenGenerator();
  const rateLimiter = new InMemoryRateLimiter();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  const sut = new RequestPasswordResetUseCase(
    users,
    resetTokens,
    tokenGen,
    rateLimiter,
    eventBus,
    clock,
    uow,
    { resetTtlMinutes: 15, perEmailCooldownSeconds: 60, perIpDailyLimit: 10 },
  );
  return { sut, users, resetTokens, rateLimiter, eventBus, clock };
}

describe("RequestPasswordResetUseCase", () => {
  it("when account does NOT exist: no token persisted, no event published, returns { found: false }", async () => {
    const { sut, resetTokens, eventBus } = makeSut();
    const result = await sut.execute({
      email: "missing@b.com",
      ip: "1.1.1.1",
      correlationId: "c",
    });
    expect(result.found).toBe(false);
    expect(resetTokens.all()).toHaveLength(0);
    expect(eventBus.published).toHaveLength(0);
  });

  it("when account exists: persists token + publishes event", async () => {
    const { sut, users, resetTokens, eventBus } = makeSut();
    await seedUser(users, "a@b.com");
    const result = await sut.execute({
      email: "a@b.com",
      ip: "1.1.1.1",
      correlationId: "c",
    });
    expect(result.found).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    expect(resetTokens.all()).toHaveLength(1);
    expect(eventBus.ofType(PasswordResetRequested)).toHaveLength(1);
  });

  it("per-email cooldown trips RateLimitedError on the second request within 60s", async () => {
    const { sut, users } = makeSut();
    await seedUser(users, "a@b.com");
    await sut.execute({ email: "a@b.com", ip: "1.1.1.1", correlationId: "c" });
    await expect(
      sut.execute({ email: "a@b.com", ip: "1.1.1.1", correlationId: "c" }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("per-IP daily cap trips RateLimitedError after 10 requests from the same IP", async () => {
    const { sut, users } = makeSut();
    // Ten different emails, but same IP — only the daily-cap counter trips.
    for (let i = 0; i < 10; i++) {
      await seedUser(users, `u${i}@b.com`);
      await sut.execute({
        email: `u${i}@b.com`,
        ip: "9.9.9.9",
        correlationId: "c",
      });
    }
    await seedUser(users, "extra@b.com");
    await expect(
      sut.execute({ email: "extra@b.com", ip: "9.9.9.9", correlationId: "c" }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("does NOT reveal account existence — unknown email also bumps the per-IP daily counter", async () => {
    const { sut } = makeSut();
    await sut.execute({
      email: "unknown@b.com",
      ip: "5.5.5.5",
      correlationId: "c",
    });
    // The per-IP counter was incremented (we expect this to be allowed but counted).
    // Verifiable by exceeding the cap with 10 unknown emails:
    for (let i = 0; i < 9; i++) {
      await sut.execute({
        email: `u${i}@nope.com`,
        ip: "5.5.5.5",
        correlationId: "c",
      });
    }
    await expect(
      sut.execute({ email: "u10@nope.com", ip: "5.5.5.5", correlationId: "c" }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});
