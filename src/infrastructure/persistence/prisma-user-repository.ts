import type { PrismaClient } from "@prisma/client";
import type { Email } from "../../domain/shared/email.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { User } from "../../domain/user/user.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import { UserMapper } from "./mappers/user-mapper.js";
import { txOrPrisma } from "./prisma-unit-of-work.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async byId(id: UserId): Promise<User | null> {
    const row = await txOrPrisma(this.prisma).user.findUnique({
      where: { id },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async byEmail(email: Email): Promise<User | null> {
    const row = await txOrPrisma(this.prisma).user.findUnique({
      where: { email: email.value },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    const now = new Date();
    const data = UserMapper.toPersistence(user, now);
    await txOrPrisma(this.prisma).user.upsert({
      where: { id: user.id },
      create: data,
      update: {
        passwordHash: user.passwordHash.value,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
        updatedAt: now,
      },
    });
  }
}
