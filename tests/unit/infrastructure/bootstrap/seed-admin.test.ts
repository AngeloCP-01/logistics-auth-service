import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import { seedAdmin } from "@/infrastructure/bootstrap/seed-admin.js";
import { FakePasswordHasher } from "@tests/fakes/fake-password-hasher.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";

const NOW = new Date("2026-05-21T10:00:00Z");
const logs: Array<[string, unknown]> = [];
const logger = {
  info: (m: string, ctx?: unknown) => logs.push([m, ctx]),
  warn: () => {},
};

beforeEach(() => {
  logs.length = 0;
});

describe("seedAdmin", () => {
  it("no-op when env vars are empty", async () => {
    const users = new InMemoryUserRepository();
    await seedAdmin({
      email: "",
      password: "",
      users,
      hasher: new FakePasswordHasher(),
      clock: { now: () => NOW },
      logger,
    });
    expect(users.all()).toHaveLength(0);
    expect(logs.some(([m]) => m === "seed_admin_skipped")).toBe(true);
  });

  it("creates the admin when the email does not exist", async () => {
    const users = new InMemoryUserRepository();
    await seedAdmin({
      email: "admin@example.com",
      password: "twelvecharsmin",
      users,
      hasher: new FakePasswordHasher(),
      clock: { now: () => NOW },
      logger,
    });
    const created = users.all();
    expect(created).toHaveLength(1);
    expect(created[0].email.value).toBe("admin@example.com");
    expect(created[0].role).toBe("admin");
    expect(logs.some(([m]) => m === "seed_admin_created")).toBe(true);
  });

  it("is idempotent — existing admin is not overwritten and password not changed", async () => {
    const users = new InMemoryUserRepository();
    const existing = User.fromPersistence({
      id: UserId.generate(),
      email: Email.of("admin@example.com"),
      passwordHash: HashedPassword.fromHash("$argon2id$existing"),
      role: "admin",
      status: "active",
      emailVerifiedAt: NOW,
      createdAt: NOW,
    });
    await users.save(existing);

    await seedAdmin({
      email: "admin@example.com",
      password: "differentpw1234",
      users,
      hasher: new FakePasswordHasher(),
      clock: { now: () => NOW },
      logger,
    });

    expect(users.all()).toHaveLength(1);
    expect(users.all()[0].passwordHash.value).toBe("$argon2id$existing");
    expect(logs.some(([m]) => m === "seed_admin_skipped")).toBe(true);
  });
});
