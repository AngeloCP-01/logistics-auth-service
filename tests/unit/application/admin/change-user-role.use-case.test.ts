import { ChangeUserRoleUseCase } from "@/application/admin/change-user-role.use-case.js";
import { FixedClock } from "@/domain/shared/clock.js";
import {
  ForbiddenSelfRoleChangeError,
  UserNotFoundError,
} from "@/domain/shared/errors.js";
import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import { RoleChanged } from "@/domain/user/events.js";
import { FakeUnitOfWork } from "@tests/fakes/fake-unit-of-work.js";
import { InMemoryUserRepository } from "@tests/fakes/in-memory-user-repository.js";
import { RecordingEventBus } from "@tests/fakes/recording-event-bus.js";

const NOW = new Date("2026-05-21T10:00:00Z");

async function seedUser(
  users: InMemoryUserRepository,
  role: "customer" | "driver" | "admin",
): Promise<UserId> {
  const id = UserId.generate();
  await users.save(
    User.fromPersistence({
      id,
      email: Email.of(`${id}@b.com`),
      passwordHash: HashedPassword.fromHash("$argon2id$fake$x"),
      role,
      status: "active",
      emailVerifiedAt: null,
      createdAt: NOW,
    }),
  );
  return id;
}

function makeSut() {
  const users = new InMemoryUserRepository();
  const eventBus = new RecordingEventBus();
  const clock = new FixedClock(NOW);
  const uow = new FakeUnitOfWork();
  return {
    sut: new ChangeUserRoleUseCase(users, eventBus, clock, uow),
    users,
    eventBus,
  };
}

describe("ChangeUserRoleUseCase", () => {
  it("happy path: changes role + publishes RoleChanged", async () => {
    const { sut, users, eventBus } = makeSut();
    const targetId = await seedUser(users, "customer");
    const adminId = await seedUser(users, "admin");

    const out = await sut.execute({
      targetUserId: targetId,
      newRole: "driver",
      actingAdminId: adminId,
      correlationId: "c",
    });

    expect(out.role).toBe("driver");
    expect(eventBus.ofType(RoleChanged)).toHaveLength(1);
  });

  it("self-change: ForbiddenSelfRoleChangeError, role unchanged, no event", async () => {
    const { sut, users, eventBus } = makeSut();
    const adminId = await seedUser(users, "admin");

    await expect(
      sut.execute({
        targetUserId: adminId,
        newRole: "customer",
        actingAdminId: adminId,
        correlationId: "c",
      }),
    ).rejects.toBeInstanceOf(ForbiddenSelfRoleChangeError);

    expect((await users.byId(adminId))!.role).toBe("admin");
    expect(eventBus.ofType(RoleChanged)).toHaveLength(0);
  });

  it("no-op when role equals current: returns updated representation, no event", async () => {
    const { sut, users, eventBus } = makeSut();
    const targetId = await seedUser(users, "customer");
    const adminId = await seedUser(users, "admin");

    const out = await sut.execute({
      targetUserId: targetId,
      newRole: "customer",
      actingAdminId: adminId,
      correlationId: "c",
    });

    expect(out.role).toBe("customer");
    expect(eventBus.ofType(RoleChanged)).toHaveLength(0);
  });

  it("unknown target: UserNotFoundError", async () => {
    const { sut, users } = makeSut();
    const adminId = await seedUser(users, "admin");
    await expect(
      sut.execute({
        targetUserId: UserId.generate(),
        newRole: "driver",
        actingAdminId: adminId,
        correlationId: "c",
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
