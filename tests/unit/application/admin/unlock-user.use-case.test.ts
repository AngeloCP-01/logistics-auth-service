import { UnlockUserUseCase } from "@/application/admin/unlock-user.use-case.js";
import { UserNotFoundError } from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import { InMemoryRateLimiter } from "@tests/fakes/in-memory-rate-limiter.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";

const NOW = new Date("2026-05-21T10:00:00Z");

describe("UnlockUserUseCase", () => {
  it("clears the per-email lockout counter", async () => {
    const users = new InMemoryUserRepository();
    const rl = new InMemoryRateLimiter();
    const id = UserId.generate();
    await users.save(
      User.fromPersistence({
        id,
        email: Email.of("a@b.com"),
        passwordHash: HashedPassword.fromHash("$argon2id$fake$x"),
        role: "customer",
        status: "active",
        emailVerifiedAt: null,
        createdAt: NOW,
      }),
    );
    for (let i = 0; i < 6; i++)
      await rl.recordFailure("lockout:email:a@b.com", 900);

    const sut = new UnlockUserUseCase(users, rl);
    await sut.execute({ targetUserId: id });

    expect(await rl.getCount("lockout:email:a@b.com")).toBe(0);
  });

  it("unknown user: UserNotFoundError", async () => {
    const users = new InMemoryUserRepository();
    const rl = new InMemoryRateLimiter();
    const sut = new UnlockUserUseCase(users, rl);
    await expect(
      sut.execute({ targetUserId: UserId.generate() }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
