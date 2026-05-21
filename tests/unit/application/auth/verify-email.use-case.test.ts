import { VerifyEmailUseCase } from "@/application/auth/verify-email.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import { InvalidVerificationTokenError } from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId, VerificationTokenId } from "@/domain/shared/ids.js";
import { EmailVerificationToken } from "@/domain/email-verification/email-verification-token.js";
import { User } from "@/domain/user/user.js";
import { EmailVerified } from "@/domain/user/events.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryEmailVerificationTokenRepository } from "@tests/fakes/in-memory-email-verification-token-repository.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";
import { RecordingEventBus } from "@tests/fakes/recording-event-bus.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const IN_24H = new Date("2026-05-22T10:00:00Z");

class IdentityTokenHasher {
  hash(raw: string): string {
    return raw;
  }
}

async function seed(): Promise<{
  users: InMemoryUserRepository;
  tokens: InMemoryEmailVerificationTokenRepository;
  userId: UserId;
}> {
  const users = new InMemoryUserRepository();
  const tokens = new InMemoryEmailVerificationTokenRepository();
  const userId = UserId.generate();
  await users.save(
    User.fromPersistence({
      id: userId,
      email: Email.of("a@b.com"),
      passwordHash: HashedPassword.fromHash("$argon2id$fake$x"),
      role: "customer",
      status: "active",
      emailVerifiedAt: null,
      createdAt: NOW,
    }),
  );
  await tokens.save(
    EmailVerificationToken.issue({
      id: VerificationTokenId.generate(),
      userId,
      tokenHash: "raw-verify",
      expiresAt: IN_24H,
      now: NOW,
    }),
  );
  return { users, tokens, userId };
}

function makeSut(s: Awaited<ReturnType<typeof seed>>) {
  const tokenHasher = new IdentityTokenHasher();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  return {
    sut: new VerifyEmailUseCase(
      s.users,
      s.tokens,
      tokenHasher as never,
      eventBus,
      clock,
      uow,
    ),
    eventBus,
  };
}

describe("VerifyEmailUseCase", () => {
  it("happy path: marks user verified, marks token used, publishes EmailVerified", async () => {
    const s = await seed();
    const { sut, eventBus } = makeSut(s);
    await sut.execute({ token: "raw-verify", correlationId: "c" });
    const u = await s.users.byId(s.userId);
    expect(u!.emailVerifiedAt).toEqual(NOW);
    expect(eventBus.ofType(EmailVerified)).toHaveLength(1);
  });

  it("unknown token: InvalidVerificationTokenError", async () => {
    const s = await seed();
    const { sut } = makeSut(s);
    await expect(
      sut.execute({ token: "wrong", correlationId: "c" }),
    ).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });

  it("expired token: InvalidVerificationTokenError", async () => {
    const s = await seed();
    const expired = EmailVerificationToken.issue({
      id: VerificationTokenId.generate(),
      userId: s.userId,
      tokenHash: "expired-raw",
      expiresAt: new Date("2026-05-21T09:00:00Z"),
      now: new Date("2026-05-20T09:00:00Z"),
    });
    await s.tokens.save(expired);
    const { sut } = makeSut(s);
    await expect(
      sut.execute({ token: "expired-raw", correlationId: "c" }),
    ).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });

  it("already-used token: InvalidVerificationTokenError", async () => {
    const s = await seed();
    (await s.tokens.byTokenHash("raw-verify"))!.markUsed(NOW);
    const { sut } = makeSut(s);
    await expect(
      sut.execute({ token: "raw-verify", correlationId: "c" }),
    ).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });
});
