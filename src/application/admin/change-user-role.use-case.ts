import type { Clock } from "../../domain/shared/clock.js";
import {
  ForbiddenSelfRoleChangeError,
  UserNotFoundError,
} from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { Role } from "../../domain/user/role.js";
import type { UserStatus } from "../../domain/user/user-status.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { EventBus } from "../ports/event-bus.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface ChangeUserRoleInput {
  targetUserId: UserId;
  newRole: Role;
  actingAdminId: UserId;
  correlationId: string;
}

export interface ChangeUserRoleOutput {
  id: UserId;
  email: string;
  role: Role;
  emailVerified: boolean;
  status: UserStatus;
  createdAt: Date;
}

export class ChangeUserRoleUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: ChangeUserRoleInput): Promise<ChangeUserRoleOutput> {
    if (input.targetUserId === input.actingAdminId) {
      throw new ForbiddenSelfRoleChangeError();
    }
    const user = await this.users.byId(input.targetUserId);
    if (!user) throw new UserNotFoundError(input.targetUserId);

    if (user.role !== input.newRole) {
      user.changeRole(input.newRole, input.actingAdminId, this.clock.now());
      await this.uow.run(async () => {
        await this.users.save(user);
      });
      await this.eventBus.publishAll(user.pullEvents(), input.correlationId);
    }

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
