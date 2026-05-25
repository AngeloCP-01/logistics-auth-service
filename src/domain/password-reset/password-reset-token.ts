import { InvariantViolationError } from "../shared/errors.js";
import type { ResetTokenId, UserId } from "../shared/ids.js";

export class PasswordResetToken {
  private constructor(
    readonly id: ResetTokenId,
    readonly userId: UserId,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private _usedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    id: ResetTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): PasswordResetToken {
    return new PasswordResetToken(
      input.id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
      null,
      input.now,
    );
  }

  static fromPersistence(input: {
    id: ResetTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): PasswordResetToken {
    return new PasswordResetToken(
      input.id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
      input.usedAt,
      input.createdAt,
    );
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  isUsable(now: Date): boolean {
    if (this._usedAt !== null) return false;
    if (now.getTime() >= this.expiresAt.getTime()) return false;
    return true;
  }

  markUsed(now: Date): void {
    if (this._usedAt !== null) {
      throw new InvariantViolationError("Password reset token already used");
    }
    this._usedAt = now;
  }
}
