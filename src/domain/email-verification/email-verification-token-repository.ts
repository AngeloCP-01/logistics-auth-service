import type { UserId } from "../shared/ids.js";
import type { EmailVerificationToken } from "./email-verification-token.js";

export interface EmailVerificationTokenRepository {
  byTokenHash(hash: string): Promise<EmailVerificationToken | null>;
  save(token: EmailVerificationToken): Promise<void>;
  /** Mark every unused verification token for this user as used. */
  revokeUnusedForUser(userId: UserId, now: Date): Promise<void>;
}
