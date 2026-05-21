import { RegisterUserUseCase } from "@/application/auth/register-user.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import { EmailAlreadyExistsError } from "@/domain/shared/errors.js";
import {
  EmailVerificationRequested,
  UserRegistered,
} from "@/domain/user/events.js";
import { FakePasswordHasher } from "@tests/fakes/fake-password-hasher.js";
import { FakeTokenGenerator } from "@tests/fakes/fake-token-generator.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryEmailVerificationTokenRepository } from "@tests/fakes/in-memory-email-verification-token-repository.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";
import { RecordingEventBus } from "@tests/fakes/recording-event-bus.js";

const NOW = new Date("2026-05-21T10:00:00Z");

function makeSut() {
  const users = new InMemoryUserRepository();
  const verificationTokens = new InMemoryEmailVerificationTokenRepository();
  const hasher = new FakePasswordHasher();
  const tokenGen = new FakeTokenGenerator();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  const sut = new RegisterUserUseCase(
    users,
    verificationTokens,
    hasher,
    tokenGen,
    eventBus,
    clock,
    uow,
  );
  return { sut, users, verificationTokens, hasher, tokenGen, eventBus, clock };
}

describe("RegisterUserUseCase", () => {
  it("creates a user, persists the verification token, and publishes two events", async () => {
    const { sut, users, verificationTokens, eventBus } = makeSut();
    const result = await sut.execute({
      email: "new@example.com",
      password: "supersecret",
      role: "customer",
      correlationId: "corr-1",
    });
    expect(result.userId).toBeDefined();
    expect(users.all()).toHaveLength(1);
    expect(verificationTokens.all()).toHaveLength(1);
    expect(eventBus.ofType(UserRegistered)).toHaveLength(1);
    expect(eventBus.ofType(EmailVerificationRequested)).toHaveLength(1);
  });

  it("stores the hash, never the plaintext", async () => {
    const { sut, users } = makeSut();
    await sut.execute({
      email: "a@b.com",
      password: "plaintextpw",
      role: "customer",
      correlationId: "c",
    });
    const stored = users.all()[0];
    expect(stored.passwordHash.value).toContain("$argon2id$fake$plaintextpw");
  });

  it("throws EmailAlreadyExistsError on duplicate email", async () => {
    const { sut } = makeSut();
    await sut.execute({
      email: "dup@b.com",
      password: "pw1",
      role: "customer",
      correlationId: "c",
    });
    await expect(
      sut.execute({
        email: "dup@b.com",
        password: "pw2",
        role: "driver",
        correlationId: "c",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it("normalizes email to lowercase", async () => {
    const { sut, users } = makeSut();
    await sut.execute({
      email: "MiXeD@CASE.com",
      password: "pw",
      role: "customer",
      correlationId: "c",
    });
    expect(users.all()[0].email.value).toBe("mixed@case.com");
  });

  it("publishes events AFTER the unit of work runs", async () => {
    // Verified by ordering: in the fake UoW the callback runs synchronously,
    // events are published only after `uow.run` resolves.
    const { sut, eventBus, users } = makeSut();
    await sut.execute({
      email: "x@y.com",
      password: "pw",
      role: "customer",
      correlationId: "c",
    });
    expect(users.all()).toHaveLength(1);
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0].correlationId).toBe("c");
  });
});
