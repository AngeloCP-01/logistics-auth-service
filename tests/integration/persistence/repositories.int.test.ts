import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { RefreshTokenId, UserId } from "@/domain/shared/ids.js";
import { RefreshToken } from "@/domain/refresh-token/refresh-token.js";
import { User } from "@/domain/user/user.js";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/prisma-refresh-token-repository.js";
import { PrismaUserRepository } from "@/infrastructure/persistence/prisma-user-repository.js";
import { PrismaUnitOfWork } from "@/infrastructure/persistence/prisma-unit-of-work.js";
import {
  resetTables,
  startPostgresWithMigrations,
  stopPostgres,
  type TestPostgres,
} from "@tests/integration/helpers/postgres-container.js";

let pg: TestPostgres;
const NOW = new Date("2026-05-21T10:00:00Z");
const FUTURE = new Date("2026-06-20T10:00:00Z");

beforeAll(async () => {
  pg = await startPostgresWithMigrations();
}, 120000);

afterAll(async () => {
  if (pg) await stopPostgres(pg);
});

beforeEach(async () => {
  await resetTables(pg.prisma);
});

describe("PrismaUserRepository", () => {
  it("save + byId + byEmail round-trip", async () => {
    const repo = new PrismaUserRepository(pg.prisma);
    const id = UserId.generate();
    const user = User.fromPersistence({
      id,
      email: Email.of("CASE@b.com"),
      passwordHash: HashedPassword.fromHash(
        "$argon2id$v=19$m=65536,t=3,p=4$abc$def",
      ),
      role: "customer",
      status: "active",
      emailVerifiedAt: null,
      createdAt: NOW,
    });
    await repo.save(user);

    const byId = await repo.byId(id);
    expect(byId?.email.value).toBe("case@b.com");

    const byEmail = await repo.byEmail(Email.of("case@B.COM"));
    expect(byEmail?.id).toBe(id);
  });
});

describe("PrismaRefreshTokenRepository", () => {
  it("revokeFamilyForward walks the chain", async () => {
    const userRepo = new PrismaUserRepository(pg.prisma);
    const tokenRepo = new PrismaRefreshTokenRepository(pg.prisma);

    const userId = UserId.generate();
    await userRepo.save(
      User.fromPersistence({
        id: userId,
        email: Email.of("a@b.com"),
        passwordHash: HashedPassword.fromHash(
          "$argon2id$v=19$m=65536,t=3,p=4$abc$def",
        ),
        role: "customer",
        status: "active",
        emailVerifiedAt: null,
        createdAt: NOW,
      }),
    );

    // Build chain A -> B -> C, A and B revoked.
    const idA = RefreshTokenId.generate();
    const idB = RefreshTokenId.generate();
    const idC = RefreshTokenId.generate();

    // Important: insert C first (no FK ref), then B (refs C), then A (refs B).
    await tokenRepo.save(
      RefreshToken.fromPersistence({
        id: idC,
        userId,
        tokenHash: "C",
        expiresAt: FUTURE,
        revokedAt: null,
        replacedById: null,
        createdFromIp: "1.1.1.1",
        userAgent: "ua",
        createdAt: NOW,
      }),
    );
    await tokenRepo.save(
      RefreshToken.fromPersistence({
        id: idB,
        userId,
        tokenHash: "B",
        expiresAt: FUTURE,
        revokedAt: new Date("2026-05-21T09:55:00Z"),
        replacedById: idC,
        createdFromIp: "1.1.1.1",
        userAgent: "ua",
        createdAt: NOW,
      }),
    );
    await tokenRepo.save(
      RefreshToken.fromPersistence({
        id: idA,
        userId,
        tokenHash: "A",
        expiresAt: FUTURE,
        revokedAt: new Date("2026-05-21T09:50:00Z"),
        replacedById: idB,
        createdFromIp: "1.1.1.1",
        userAgent: "ua",
        createdAt: NOW,
      }),
    );

    await tokenRepo.revokeFamilyForward(idA, NOW);

    const cAfter = await tokenRepo.byId(idC);
    expect(cAfter?.revokedAt).toEqual(NOW);
  });

  it("revokeAllForUser revokes only unrevoked tokens", async () => {
    const userRepo = new PrismaUserRepository(pg.prisma);
    const tokenRepo = new PrismaRefreshTokenRepository(pg.prisma);
    const userId = UserId.generate();
    await userRepo.save(
      User.fromPersistence({
        id: userId,
        email: Email.of("a@b.com"),
        passwordHash: HashedPassword.fromHash(
          "$argon2id$v=19$m=65536,t=3,p=4$abc$def",
        ),
        role: "customer",
        status: "active",
        emailVerifiedAt: null,
        createdAt: NOW,
      }),
    );

    const alreadyRevokedId = RefreshTokenId.generate();
    const liveId = RefreshTokenId.generate();
    const oldRevokedAt = new Date("2026-05-20T00:00:00Z");
    await tokenRepo.save(
      RefreshToken.fromPersistence({
        id: alreadyRevokedId,
        userId,
        tokenHash: "X",
        expiresAt: FUTURE,
        revokedAt: oldRevokedAt,
        replacedById: null,
        createdFromIp: "1.1.1.1",
        userAgent: "y",
        createdAt: NOW,
      }),
    );
    await tokenRepo.save(
      RefreshToken.issue({
        id: liveId,
        userId,
        tokenHash: "Y",
        expiresAt: FUTURE,
        ip: "1.1.1.1",
        userAgent: "y",
        now: NOW,
      }),
    );

    await tokenRepo.revokeAllForUser(userId, NOW);

    const xAfter = await tokenRepo.byId(alreadyRevokedId);
    const yAfter = await tokenRepo.byId(liveId);
    expect(xAfter?.revokedAt).toEqual(oldRevokedAt); // unchanged
    expect(yAfter?.revokedAt).toEqual(NOW); // newly revoked
  });
});

describe("PrismaUnitOfWork", () => {
  it("rolls back when the callback throws", async () => {
    const userRepo = new PrismaUserRepository(pg.prisma);
    const uow = new PrismaUnitOfWork(pg.prisma);
    const id = UserId.generate();

    await expect(
      uow.run(async () => {
        await userRepo.save(
          User.fromPersistence({
            id,
            email: Email.of("tx@b.com"),
            passwordHash: HashedPassword.fromHash(
              "$argon2id$v=19$m=65536,t=3,p=4$abc$def",
            ),
            role: "customer",
            status: "active",
            emailVerifiedAt: null,
            createdAt: NOW,
          }),
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow(/boom/);

    const after = await userRepo.byId(id);
    expect(after).toBeNull();
  });
});
