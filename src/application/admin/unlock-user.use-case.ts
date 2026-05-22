import { UserNotFoundError } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { RateLimiter } from "../ports/rate-limiter.js";

export interface UnlockUserInput {
  targetUserId: UserId;
}

export class UnlockUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(input: UnlockUserInput): Promise<void> {
    const user = await this.users.byId(input.targetUserId);
    if (!user) throw new UserNotFoundError(input.targetUserId);
    await this.rateLimiter.clear(`lockout:email:${user.email.value}`);
  }
}
