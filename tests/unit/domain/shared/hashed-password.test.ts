import {
  HashedPassword,
  InvalidHashedPasswordError,
} from "@/domain/shared/hashed-password.js";

const VALID = "$argon2id$v=19$m=65536,t=3,p=4$abc$def";

describe("HashedPassword", () => {
  it("accepts a valid argon2id hash", () => {
    const p = HashedPassword.fromHash(VALID);
    expect(p.value).toBe(VALID);
  });

  it("rejects an empty string", () => {
    expect(() => HashedPassword.fromHash("")).toThrow(
      InvalidHashedPasswordError,
    );
  });

  it("rejects a bcrypt-style hash", () => {
    expect(() => HashedPassword.fromHash("$2b$10$abc")).toThrow(
      InvalidHashedPasswordError,
    );
  });

  it("rejects a plaintext password", () => {
    expect(() => HashedPassword.fromHash("hunter2")).toThrow(
      InvalidHashedPasswordError,
    );
  });
});
