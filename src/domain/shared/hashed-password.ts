import { DomainError } from "./errors.js";

const ARGON2ID_PREFIX = "$argon2id$";

export class InvalidHashedPasswordError extends DomainError {
  readonly code = "invalid_hashed_password";
  readonly status = 500;
  constructor() {
    super("HashedPassword expects an argon2id-encoded string");
  }
}

export class HashedPassword {
  private constructor(readonly value: string) {}

  static fromHash(hash: string): HashedPassword {
    if (typeof hash !== "string" || !hash.startsWith(ARGON2ID_PREFIX)) {
      throw new InvalidHashedPasswordError();
    }
    return new HashedPassword(hash);
  }

  equals(other: HashedPassword): boolean {
    return this.value === other.value;
  }
}
