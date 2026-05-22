import { GetMeUseCase } from "@/application/auth/get-me.use-case.js";
import { UserNotFoundError } from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";

const NOW = new Date("2026-05-21T10:00:00Z");

describe("GetMeUseCase", () => {
  it("returns user profile fields", async () => {
    const users = new InMemoryUserRepository();
    const id = UserId.generate();
    await users.save(
      User.fromPersistence({
        id,
        email: Email.of("a@b.com"),
        passwordHash: HashedPassword.fromHash("$argon2id$fake$x"),
        role: "customer",
        status: "active",
        emailVerifiedAt: NOW,
        createdAt: NOW,
      }),
    );
    const sut = new GetMeUseCase(users);
    const out = await sut.execute({ userId: id });
    expect(out).toEqual({
      id,
      email: "a@b.com",
      role: "customer",
      emailVerified: true,
      status: "active",
      createdAt: NOW,
    });
  });

  it("throws UserNotFoundError for unknown id", async () => {
    const users = new InMemoryUserRepository();
    const sut = new GetMeUseCase(users);
    await expect(
      sut.execute({ userId: UserId.generate() }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
