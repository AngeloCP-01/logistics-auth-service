import type { UserId, VerificationTokenId } from "../shared/ids.js";

export class EmailVerificationToken {
  private constructor(
    readonly id: VerificationTokenId,
    readonly userId: UserId,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private _usedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    id: VerificationTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): EmailVerificationToken {
    return new EmailVerificationToken(
      input.id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
      null,
      input.now,
    );
  }

  static fromPersistence(input: {
    id: VerificationTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): EmailVerificationToken {
    return new EmailVerificationToken(
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
      throw new Error("email verification token already used");
    }
    this._usedAt = now;
  }
}
