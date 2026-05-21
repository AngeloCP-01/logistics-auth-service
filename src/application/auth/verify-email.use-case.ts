import type { Clock } from "../../domain/shared/clock.js";
import { InvalidVerificationTokenError } from "../../domain/shared/errors.js";
import type { EmailVerificationTokenRepository } from "../../domain/email-verification/email-verification-token-repository.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { EventBus } from "../ports/event-bus.js";
import type { TokenHasher } from "../ports/token-hasher.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface VerifyEmailInput {
  token: string;
  correlationId: string;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: EmailVerificationTokenRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: VerifyEmailInput): Promise<void> {
    const now = this.clock.now();
    const hash = this.tokenHasher.hash(input.token);
    const token = await this.tokens.byTokenHash(hash);
    if (!token || !token.isUsable(now))
      throw new InvalidVerificationTokenError();

    const user = await this.users.byId(token.userId);
    if (!user) throw new InvalidVerificationTokenError();

    user.markEmailVerified(now);
    token.markUsed(now);

    await this.uow.run(async () => {
      await this.users.save(user);
      await this.tokens.save(token);
    });
    await this.eventBus.publishAll(user.pullEvents(), input.correlationId);
  }
}
