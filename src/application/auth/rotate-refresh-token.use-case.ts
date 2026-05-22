import type { Clock } from "../../domain/shared/clock.js";
import {
  TokenExpiredError,
  TokenReusedError,
} from "../../domain/shared/errors.js";
import { RefreshTokenId } from "../../domain/shared/ids.js";
import type { RefreshTokenRepository } from "../../domain/refresh-token/refresh-token-repository.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { AccessTokenIssuer } from "../ports/access-token-issuer.js";
import type { TokenGenerator } from "../ports/token-generator.js";
import type { TokenHasher } from "../ports/token-hasher.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface RotateRefreshTokenInput {
  refreshToken: string;
  ip: string;
  userAgent: string;
}

export interface RotateRefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface RotateRefreshTokenConfig {
  refreshTtlDays: number;
}

export class RotateRefreshTokenUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokenGen: TokenGenerator,
    private readonly tokenHasher: TokenHasher,
    private readonly accessTokens: AccessTokenIssuer,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
    private readonly config: RotateRefreshTokenConfig,
  ) {}

  async execute(
    input: RotateRefreshTokenInput,
  ): Promise<RotateRefreshTokenOutput> {
    const now = this.clock.now();
    const incomingHash = this.tokenHasher.hash(input.refreshToken);

    const existing = await this.refreshTokens.byTokenHash(incomingHash);
    if (!existing) throw new TokenExpiredError();

    if (existing.revokedAt !== null) {
      // Reuse detection. Revoke the family forward from this token.
      await this.refreshTokens.revokeFamilyForward(existing.id, now);
      throw new TokenReusedError();
    }
    if (!existing.isUsable(now)) {
      throw new TokenExpiredError();
    }

    const { raw, hash } = this.tokenGen.generate();
    const newExpiresAt = new Date(
      now.getTime() + this.config.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    const { revoked, next } = existing.rotate({
      newId: RefreshTokenId.generate(),
      newHash: hash,
      newExpiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
      now,
    });

    await this.uow.run(async () => {
      await this.refreshTokens.save(next);
      await this.refreshTokens.save(revoked);
    });

    const user = await this.users.byId(existing.userId);
    if (!user) throw new TokenExpiredError(); // user deleted out from under us
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
}
