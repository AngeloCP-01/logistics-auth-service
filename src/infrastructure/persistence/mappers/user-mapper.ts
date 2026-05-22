import type { Prisma, User as PrismaUser } from "@prisma/client";
import { Email } from "../../../domain/shared/email.js";
import { HashedPassword } from "../../../domain/shared/hashed-password.js";
import { UserId } from "../../../domain/shared/ids.js";
import { User } from "../../../domain/user/user.js";

export const UserMapper = {
  toDomain(row: PrismaUser): User {
    return User.fromPersistence({
      id: UserId.of(row.id),
      email: Email.of(row.email),
      passwordHash: HashedPassword.fromHash(row.passwordHash),
      role: row.role,
      status: row.status,
      emailVerifiedAt: row.emailVerifiedAt,
      createdAt: row.createdAt,
    });
  },
  toPersistence(user: User, now: Date): Prisma.UserUncheckedCreateInput {
    return {
      id: user.id,
      email: user.email.value,
      passwordHash: user.passwordHash.value,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: now,
    };
  },
};
