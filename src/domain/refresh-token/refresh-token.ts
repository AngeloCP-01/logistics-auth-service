import { InvariantViolationError } from "../shared/errors.js";
import type { RefreshTokenId, UserId } from "../shared/ids.js";

export interface RefreshTokenRotationInput {
  newId: RefreshTokenId;
  newHash: string;
  newExpiresAt: Date;
  ip: string;
  userAgent: string;
  now: Date;
}

export interface RefreshTokenRotationResult {
  revoked: RefreshToken;
  next: RefreshToken;
}

export class RefreshToken {
  private constructor(
    readonly id: RefreshTokenId,
    readonly userId: UserId,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private _revokedAt: Date | null,
    private _replacedById: RefreshTokenId | null,
    readonly createdFromIp: string,
    readonly userAgent: string,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    id: RefreshTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    ip: string;
    userAgent: string;
    now: Date;
  }): RefreshToken {
    return new RefreshToken(
      input.id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
      null,
      null,
      input.ip,
      input.userAgent,
      input.now,
    );
  }

  static fromPersistence(input: {
    id: RefreshTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedById: RefreshTokenId | null;
    createdFromIp: string;
    userAgent: string;
    createdAt: Date;
  }): RefreshToken {
    return new RefreshToken(
      input.id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
      input.revokedAt,
      input.replacedById,
      input.createdFromIp,
      input.userAgent,
      input.createdAt,
    );
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }
  get replacedById(): RefreshTokenId | null {
    return this._replacedById;
  }

  isUsable(now: Date): boolean {
    if (this._revokedAt !== null) return false;
    if (now.getTime() >= this.expiresAt.getTime()) return false;
    return true;
  }

  revokeAlone(now: Date): void {
    if (this._revokedAt !== null) return;
    this._revokedAt = now;
  }

  rotate(input: RefreshTokenRotationInput): RefreshTokenRotationResult {
    if (this._revokedAt !== null) {
      throw new InvariantViolationError("Refresh token already revoked");
    }
    const next = RefreshToken.issue({
      id: input.newId,
      userId: this.userId,
      tokenHash: input.newHash,
      expiresAt: input.newExpiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
      now: input.now,
    });
    this._revokedAt = input.now;
    this._replacedById = input.newId;
    return { revoked: this, next };
  }
}
