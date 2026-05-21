import type { Clock } from "../../domain/shared/clock.js";
import { Email } from "../../domain/shared/email.js";
import { RateLimitedError } from "../../domain/shared/errors.js";
import { ResetTokenId } from "../../domain/shared/ids.js";
import { PasswordResetToken } from "../../domain/password-reset/password-reset-token.js";
import type { PasswordResetTokenRepository } from "../../domain/password-reset/password-reset-token-repository.js";
import { PasswordResetRequested } from "../../domain/user/events.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { EventBus } from "../ports/event-bus.js";
import type { RateLimiter } from "../ports/rate-limiter.js";
import type { TokenGenerator } from "../ports/token-generator.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface RequestPasswordResetInput {
  email: string;
  ip: string;
  correlationId: string;
}

export interface RequestPasswordResetOutput {
  found: boolean;
  token?: string;
  expiresAt?: Date;
}

export interface RequestPasswordResetConfig {
  resetTtlMinutes: number;
  perEmailCooldownSeconds: number;
  perIpDailyLimit: number;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly tokenGen: TokenGenerator,
    private readonly rateLimiter: RateLimiter,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
    private readonly config: RequestPasswordResetConfig,
  ) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetOutput> {
    const emailLower = input.email.toLowerCase();
    const ipDaily = await this.rateLimiter.incrementDaily(
      `reset:daily:ip:${input.ip}`,
      this.config.perIpDailyLimit,
    );
    if (!ipDaily.allowed) throw new RateLimitedError(ipDaily.retryAfterSeconds);

    const cooldown = await this.rateLimiter.cooldown(
      `reset:cooldown:email:${emailLower}`,
      this.config.perEmailCooldownSeconds,
    );
    if (!cooldown.allowed)
      throw new RateLimitedError(cooldown.retryAfterSeconds);

    let email;
    try {
      email = Email.of(input.email);
    } catch {
      return { found: false };
    }

    const user = await this.users.byEmail(email);
    if (!user || !user.isActive()) {
      return { found: false };
    }

    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.resetTtlMinutes * 60 * 1000,
    );
    const { raw, hash } = this.tokenGen.generate();
    const token = PasswordResetToken.issue({
      id: ResetTokenId.generate(),
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      now,
    });

    await this.uow.run(async () => {
      await this.resetTokens.save(token);
    });
    await this.eventBus.publishAll(
      [new PasswordResetRequested(user.id, user.email, raw, expiresAt, now)],
      input.correlationId,
    );

    return { found: true, token: raw, expiresAt };
  }
}
