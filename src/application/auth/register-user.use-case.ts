import type { EventBus } from "../ports/event-bus.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { TokenGenerator } from "../ports/token-generator.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

import { EmailVerificationToken } from "../../domain/email-verification/email-verification-token.js";
import type { EmailVerificationTokenRepository } from "../../domain/email-verification/email-verification-token-repository.js";
import type { Clock } from "../../domain/shared/clock.js";
import { Email } from "../../domain/shared/email.js";
import { EmailAlreadyExistsError } from "../../domain/shared/errors.js";
import { UserId, VerificationTokenId } from "../../domain/shared/ids.js";
import type { PublicRegistrationRole } from "../../domain/user/role.js";
import { User } from "../../domain/user/user.js";
import type { UserRepository } from "../../domain/user/user-repository.js";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegisterUserInput {
  email: string;
  password: string;
  role: PublicRegistrationRole;
  correlationId: string;
}

export interface RegisterUserOutput {
  userId: UserId;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly verificationTokens: EmailVerificationTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenGen: TokenGenerator,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const email = Email.of(input.email);
    const now = this.clock.now();

    const existing = await this.users.byEmail(email);
    if (existing) throw new EmailAlreadyExistsError(email.value);

    const passwordHash = await this.hasher.hash(input.password);
    const userId = UserId.generate();
    const user = User.register({
      id: userId,
      email,
      passwordHash,
      role: input.role,
      now,
    });

    const { raw, hash } = this.tokenGen.generate();
    const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);
    const verificationToken = EmailVerificationToken.issue({
      id: VerificationTokenId.generate(),
      userId,
      tokenHash: hash,
      expiresAt,
      now,
    });
    user.recordEmailVerificationRequested(raw, expiresAt, now);

    await this.uow.run(async () => {
      await this.users.save(user);
      await this.verificationTokens.save(verificationToken);
    });
    await this.eventBus.publishAll(user.pullEvents(), input.correlationId);

    return { userId };
  }
}
