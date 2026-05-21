import type { HashedPassword } from "../../domain/shared/hashed-password.js";

export interface PasswordHasher {
  hash(plaintext: string): Promise<HashedPassword>;
  verify(hash: HashedPassword, plaintext: string): Promise<boolean>;
  /** Verify against a sentinel hash to absorb timing for unknown-email login. */
  verifyAgainstSentinel(plaintext: string): Promise<void>;
}
