import argon2 from "argon2";
import { HashedPassword } from "../../domain/shared/hashed-password.js";
import type { PasswordHasher } from "../../application/ports/password-hasher.js";

export interface Argon2Options {
  memoryCost: number; // KiB
  timeCost: number;
  parallelism: number;
}

const DEFAULT_OPTIONS: Argon2Options = {
  memoryCost: 19 * 1024, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export class Argon2PasswordHasher implements PasswordHasher {
  private sentinelHashPromise: Promise<string> | null = null;
  constructor(private readonly opts: Argon2Options = DEFAULT_OPTIONS) {}

  async hash(plaintext: string): Promise<HashedPassword> {
    const v = await argon2.hash(plaintext, {
      type: argon2.argon2id,
      memoryCost: this.opts.memoryCost,
      timeCost: this.opts.timeCost,
      parallelism: this.opts.parallelism,
    });
    return HashedPassword.fromHash(v);
  }

  async verify(hashed: HashedPassword, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hashed.value, plaintext);
    } catch {
      return false;
    }
  }

  async verifyAgainstSentinel(plaintext: string): Promise<void> {
    if (!this.sentinelHashPromise) {
      this.sentinelHashPromise = argon2.hash("sentinel-not-a-real-password", {
        type: argon2.argon2id,
        memoryCost: this.opts.memoryCost,
        timeCost: this.opts.timeCost,
        parallelism: this.opts.parallelism,
      });
    }
    const sentinelHash = await this.sentinelHashPromise;
    try {
      await argon2.verify(sentinelHash, plaintext);
    } catch {
      // ignore — we only care about timing
    }
  }
}
