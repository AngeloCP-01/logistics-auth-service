import { UserNotFoundError } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { Role } from "../../domain/user/role.js";
import type { UserStatus } from "../../domain/user/user-status.js";
import type { UserRepository } from "../../domain/user/user-repository.js";

export interface GetMeInput {
  userId: UserId;
}

export interface GetMeOutput {
  id: UserId;
  email: string;
  role: Role;
  emailVerified: boolean;
  status: UserStatus;
  createdAt: Date;
}

export class GetMeUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: GetMeInput): Promise<GetMeOutput> {
    const user = await this.users.byId(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);
    return {
      id: user.id,
      email: user.email.value,
      role: user.role,
      emailVerified: user.isEmailVerified(),
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
