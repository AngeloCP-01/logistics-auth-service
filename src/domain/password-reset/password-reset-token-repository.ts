import type { UserId } from "../shared/ids.js";
import type { PasswordResetToken } from "./password-reset-token.js";

export interface PasswordResetTokenRepository {
  byTokenHash(hash: string): Promise<PasswordResetToken | null>;
  save(token: PasswordResetToken): Promise<void>;
  /** Mark every unused reset token for this user as used (used_at=now). */
  revokeUnusedForUser(userId: UserId, now: Date): Promise<void>;
}
