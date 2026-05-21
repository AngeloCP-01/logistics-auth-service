import type { Clock } from "../../domain/shared/clock.js";
import type { RefreshTokenRepository } from "../../domain/refresh-token/refresh-token-repository.js";
import type { TokenHasher } from "../ports/token-hasher.js";

export interface LogoutInput {
  refreshToken: string;
}

export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const hash = this.tokenHasher.hash(input.refreshToken);
    const token = await this.refreshTokens.byTokenHash(hash);
    if (!token) return;
    if (token.revokedAt !== null) return;
    token.revokeAlone(this.clock.now());
    await this.refreshTokens.save(token);
  }
}
