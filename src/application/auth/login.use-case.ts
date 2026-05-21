import {
  AccountLockedError,
  InvalidCredentialsError,
} from "../../domain/shared/errors.js";
import { Email } from "../../domain/shared/email.js";
import type { Clock } from "../../domain/shared/clock.js";
import { RefreshTokenId } from "../../domain/shared/ids.js";
import { RefreshToken } from "../../domain/refresh-token/refresh-token.js";
import type { RefreshTokenRepository } from "../../domain/refresh-token/refresh-token-repository.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { AccessTokenIssuer } from "../ports/access-token-issuer.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { RateLimiter } from "../ports/rate-limiter.js";
import type { TokenGenerator } from "../ports/token-generator.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface LoginInput {
  email: string;
  password: string;
  ip: string;
  userAgent: string;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginConfig {
  refreshTtlDays: number;
  lockoutThreshold: number;
  lockoutWindowSeconds: number;
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenGen: TokenGenerator,
    private readonly rateLimiter: RateLimiter,
    private readonly accessTokens: AccessTokenIssuer,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
    private readonly config: LoginConfig,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const emailKey = `lockout:email:${input.email.toLowerCase()}`;
    const ipKey = `lockout:ip:${input.ip}`;

    const [emailCount, ipCount] = await Promise.all([
      this.rateLimiter.getCount(emailKey),
      this.rateLimiter.getCount(ipKey),
    ]);
    if (
      emailCount >= this.config.lockoutThreshold ||
      ipCount >= this.config.lockoutThreshold
    ) {
      const [emailTtl, ipTtl] = await Promise.all([
        this.rateLimiter.ttl(emailKey),
        this.rateLimiter.ttl(ipKey),
      ]);
      throw new AccountLockedError(Math.max(emailTtl, ipTtl, 1));
    }

    let email;
    try {
      email = Email.of(input.email);
    } catch {
      throw new InvalidCredentialsError();
    }
    const user = await this.users.byEmail(email);

    if (!user) {
      await this.hasher.verifyAgainstSentinel(input.password);
      await this.recordFailure(emailKey, ipKey);
      throw new InvalidCredentialsError();
    }
    if (!user.isActive()) {
      await this.recordFailure(emailKey, ipKey);
      throw new InvalidCredentialsError();
    }

    const ok = await this.hasher.verify(user.passwordHash, input.password);
    if (!ok) {
      await this.recordFailure(emailKey, ipKey);
      throw new InvalidCredentialsError();
    }

    await Promise.all([
      this.rateLimiter.clear(emailKey),
      this.rateLimiter.clear(ipKey),
    ]);

    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    const { raw, hash } = this.tokenGen.generate();
    const refreshToken = RefreshToken.issue({
      id: RefreshTokenId.generate(),
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
      now,
    });

    await this.uow.run(async () => {
      await this.refreshTokens.save(refreshToken);
    });

    const access = this.accessTokens.issue(
      { sub: user.id, role: user.role, email_verified: user.isEmailVerified() },
      now,
    );

    return {
      accessToken: access.token,
      refreshToken: raw,
      expiresIn: access.expiresIn,
      tokenType: "Bearer",
    };
  }

  private async recordFailure(emailKey: string, ipKey: string): Promise<void> {
    await Promise.all([
      this.rateLimiter.recordFailure(
        emailKey,
        this.config.lockoutWindowSeconds,
      ),
      this.rateLimiter.recordFailure(ipKey, this.config.lockoutWindowSeconds),
    ]);
  }
}
