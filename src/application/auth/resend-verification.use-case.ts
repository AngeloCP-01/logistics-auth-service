import type { Clock } from "../../domain/shared/clock.js";
import {
  AlreadyVerifiedError,
  RateLimitedError,
  UserNotFoundError,
} from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import { VerificationTokenId } from "../../domain/shared/ids.js";
import { EmailVerificationToken } from "../../domain/email-verification/email-verification-token.js";
import type { EmailVerificationTokenRepository } from "../../domain/email-verification/email-verification-token-repository.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { EventBus } from "../ports/event-bus.js";
import type { RateLimiter } from "../ports/rate-limiter.js";
import type { TokenGenerator } from "../ports/token-generator.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface ResendVerificationInput {
  userId: UserId;
  correlationId: string;
}

export interface ResendVerificationOutput {
  token: string;
  expiresAt: Date;
}

export interface ResendVerificationConfig {
  verificationTtlHours: number;
  perUserCooldownSeconds: number;
}

export class ResendVerificationUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: EmailVerificationTokenRepository,
    private readonly tokenGen: TokenGenerator,
    private readonly rateLimiter: RateLimiter,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
    private readonly config: ResendVerificationConfig,
  ) {}

  async execute(
    input: ResendVerificationInput,
  ): Promise<ResendVerificationOutput> {
    const user = await this.users.byId(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);
    if (user.isEmailVerified()) throw new AlreadyVerifiedError();

    const cooldown = await this.rateLimiter.cooldown(
      `verify:cooldown:user:${input.userId}`,
      this.config.perUserCooldownSeconds,
    );
    if (!cooldown.allowed)
      throw new RateLimitedError(cooldown.retryAfterSeconds);

    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.verificationTtlHours * 60 * 60 * 1000,
    );
    const { raw, hash } = this.tokenGen.generate();
    const token = EmailVerificationToken.issue({
      id: VerificationTokenId.generate(),
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      now,
    });
    user.recordEmailVerificationRequested(raw, expiresAt, now);

    await this.uow.run(async () => {
      await this.tokens.revokeUnusedForUser(user.id, now);
      await this.tokens.save(token);
    });
    await this.eventBus.publishAll(user.pullEvents(), input.correlationId);

    return { token: raw, expiresAt };
  }
}
