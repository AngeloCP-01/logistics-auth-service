import type { Clock } from "../../domain/shared/clock.js";
import { InvalidResetTokenError } from "../../domain/shared/errors.js";
import type { PasswordResetTokenRepository } from "../../domain/password-reset/password-reset-token-repository.js";
import type { RefreshTokenRepository } from "../../domain/refresh-token/refresh-token-repository.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { EventBus } from "../ports/event-bus.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { TokenHasher } from "../ports/token-hasher.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
  correlationId: string;
}

export class ConfirmPasswordResetUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenHasher: TokenHasher,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: ConfirmPasswordResetInput): Promise<void> {
    const now = this.clock.now();
    const hash = this.tokenHasher.hash(input.token);
    const reset = await this.resetTokens.byTokenHash(hash);
    if (!reset || !reset.isUsable(now)) throw new InvalidResetTokenError();

    const user = await this.users.byId(reset.userId);
    if (!user) throw new InvalidResetTokenError();

    const newHash = await this.hasher.hash(input.newPassword);
    user.changePassword(newHash, now);
    reset.markUsed(now);

    await this.uow.run(async () => {
      await this.users.save(user);
      await this.resetTokens.save(reset);
      await this.refreshTokens.revokeAllForUser(user.id, now);
    });
    await this.eventBus.publishAll(user.pullEvents(), input.correlationId);
  }
}
