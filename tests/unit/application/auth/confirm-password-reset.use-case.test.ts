import { ConfirmPasswordResetUseCase } from "@/application/auth/confirm-password-reset.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import { InvalidResetTokenError } from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { ResetTokenId, RefreshTokenId, UserId } from "@/domain/shared/ids.js";
import { PasswordResetToken } from "@/domain/password-reset/password-reset-token.js";
import { RefreshToken } from "@/domain/refresh-token/refresh-token.js";
import { User } from "@/domain/user/user.js";
import { PasswordChanged } from "@/domain/user/events.js";
import { FakePasswordHasher } from "@tests/fakes/fake-password-hasher.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryPasswordResetTokenRepository } from "@tests/fakes/in-memory-password-reset-token-repository.js";
import { InMemoryRefreshTokenRepository } from "@tests/fakes/in-memory-refresh-token-repository.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";
import { RecordingEventBus } from "@tests/fakes/recording-event-bus.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const FUTURE = new Date("2026-05-21T10:14:00Z");
const FAR_FUTURE = new Date("2026-06-20T10:00:00Z");

class IdentityTokenHasher {
  hash(raw: string): string {
    return raw;
  }
}

async function seedUserAndToken(): Promise<{
  users: InMemoryUserRepository;
  resetTokens: InMemoryPasswordResetTokenRepository;
  refreshTokens: InMemoryRefreshTokenRepository;
  userId: UserId;
}> {
  const users = new InMemoryUserRepository();
  const resetTokens = new InMemoryPasswordResetTokenRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const userId = UserId.generate();
  await users.save(
    User.fromPersistence({
      id: userId,
      email: Email.of("a@b.com"),
      passwordHash: HashedPassword.fromHash("$argon2id$fake$old"),
      role: "customer",
      status: "active",
      emailVerifiedAt: null,
      createdAt: NOW,
    }),
  );
  await resetTokens.save(
    PasswordResetToken.issue({
      id: ResetTokenId.generate(),
      userId,
      tokenHash: "raw-reset",
      expiresAt: FUTURE,
      now: NOW,
    }),
  );
  await refreshTokens.save(
    RefreshToken.issue({
      id: RefreshTokenId.generate(),
      userId,
      tokenHash: "raw-refresh",
      expiresAt: FAR_FUTURE,
      ip: "x",
      userAgent: "y",
      now: NOW,
    }),
  );
  return { users, resetTokens, refreshTokens, userId };
}

function makeSut(args: Awaited<ReturnType<typeof seedUserAndToken>>) {
  const hasher = new FakePasswordHasher();
  const tokenHasher = new IdentityTokenHasher();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  const sut = new ConfirmPasswordResetUseCase(
    args.users,
    args.resetTokens,
    args.refreshTokens,
    hasher,
    tokenHasher as never,
    eventBus,
    clock,
    uow,
  );
  return { sut, hasher, eventBus };
}

describe("ConfirmPasswordResetUseCase", () => {
  it("happy path: changes password, marks token used, revokes refresh tokens, publishes event", async () => {
    const args = await seedUserAndToken();
    const { sut, eventBus } = makeSut(args);

    await sut.execute({
      token: "raw-reset",
      newPassword: "newsecret9",
      correlationId: "c",
    });

    const user = await args.users.byId(args.userId);
    expect(user!.passwordHash.value).toBe("$argon2id$fake$newsecret9");
    const reset = await args.resetTokens.byTokenHash("raw-reset");
    expect(reset!.usedAt).toEqual(NOW);
    const refresh = args.refreshTokens.all()[0];
    expect(refresh.revokedAt).toEqual(NOW);
    expect(eventBus.ofType(PasswordChanged)).toHaveLength(1);
  });

  it("throws InvalidResetTokenError for unknown token", async () => {
    const args = await seedUserAndToken();
    const { sut } = makeSut(args);
    await expect(
      sut.execute({
        token: "wrong",
        newPassword: "newsecret9",
        correlationId: "c",
      }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it("throws InvalidResetTokenError for already-used token", async () => {
    const args = await seedUserAndToken();
    const reset = (await args.resetTokens.byTokenHash("raw-reset"))!;
    reset.markUsed(NOW);
    const { sut } = makeSut(args);
    await expect(
      sut.execute({
        token: "raw-reset",
        newPassword: "newsecret9",
        correlationId: "c",
      }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it("throws InvalidResetTokenError for expired token", async () => {
    const args = await seedUserAndToken();
    // overwrite the existing token with an expired one
    const expired = PasswordResetToken.issue({
      id: ResetTokenId.generate(),
      userId: args.userId,
      tokenHash: "expired-raw",
      expiresAt: new Date("2026-05-21T09:00:00Z"),
      now: new Date("2026-05-21T08:45:00Z"),
    });
    await args.resetTokens.save(expired);
    const { sut } = makeSut(args);
    await expect(
      sut.execute({
        token: "expired-raw",
        newPassword: "newsecret9",
        correlationId: "c",
      }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });
});
