import { ResendVerificationUseCase } from "@/application/auth/resend-verification.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import {
  AlreadyVerifiedError,
  RateLimitedError,
  UserNotFoundError,
} from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import { EmailVerificationRequested } from "@/domain/user/events.js";
import { FakeTokenGenerator } from "@tests/fakes/fake-token-generator.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryEmailVerificationTokenRepository } from "@tests/fakes/in-memory-email-verification-token-repository.js";
import { InMemoryRateLimiter } from "@tests/fakes/in-memory-rate-limiter.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";
import { RecordingEventBus } from "@tests/fakes/recording-event-bus.js";

const NOW = new Date("2026-05-21T10:00:00Z");

async function seedUser(
  users: InMemoryUserRepository,
  verified: boolean,
): Promise<UserId> {
  const id = UserId.generate();
  await users.save(
    User.fromPersistence({
      id,
      email: Email.of("a@b.com"),
      passwordHash: HashedPassword.fromHash("$argon2id$fake$x"),
      role: "customer",
      status: "active",
      emailVerifiedAt: verified ? NOW : null,
      createdAt: NOW,
    }),
  );
  return id;
}

function makeSut() {
  const users = new InMemoryUserRepository();
  const tokens = new InMemoryEmailVerificationTokenRepository();
  const tokenGen = new FakeTokenGenerator();
  const rateLimiter = new InMemoryRateLimiter();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  const sut = new ResendVerificationUseCase(
    users,
    tokens,
    tokenGen,
    rateLimiter,
    eventBus,
    clock,
    uow,
    { verificationTtlHours: 24, perUserCooldownSeconds: 60 },
  );
  return { sut, users, tokens, eventBus, rateLimiter };
}

describe("ResendVerificationUseCase", () => {
  it("happy path: revokes prior unused tokens, issues new one, publishes event", async () => {
    const { sut, users, tokens, eventBus } = makeSut();
    const id = await seedUser(users, false);

    const result = await sut.execute({ userId: id, correlationId: "c" });

    expect(result.token).toBeDefined();
    expect(tokens.all()).toHaveLength(1);
    expect(eventBus.ofType(EmailVerificationRequested)).toHaveLength(1);
  });

  it("already verified: AlreadyVerifiedError", async () => {
    const { sut, users } = makeSut();
    const id = await seedUser(users, true);
    await expect(
      sut.execute({ userId: id, correlationId: "c" }),
    ).rejects.toBeInstanceOf(AlreadyVerifiedError);
  });

  it("rate-limited on second call within 60s", async () => {
    const { sut, users } = makeSut();
    const id = await seedUser(users, false);
    await sut.execute({ userId: id, correlationId: "c" });
    await expect(
      sut.execute({ userId: id, correlationId: "c" }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("unknown user: UserNotFoundError", async () => {
    const { sut } = makeSut();
    await expect(
      sut.execute({ userId: UserId.generate(), correlationId: "c" }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
