import { HashedPassword } from "@/domain/shared/hashed-password.js";
import type { PasswordHasher } from "@/application/ports/password-hasher.js";

/** Deterministic, no-crypto fake. Hash = "$argon2id$fake$<plaintext>". */
export class FakePasswordHasher implements PasswordHasher {
  sentinelVerifications = 0;

  async hash(plaintext: string): Promise<HashedPassword> {
    return HashedPassword.fromHash(`$argon2id$fake$${plaintext}`);
  }
  async verify(hash: HashedPassword, plaintext: string): Promise<boolean> {
    return hash.value === `$argon2id$fake$${plaintext}`;
  }
  async verifyAgainstSentinel(_plaintext: string): Promise<void> {
    this.sentinelVerifications += 1;
  }
}
