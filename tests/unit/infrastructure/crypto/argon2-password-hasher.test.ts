import { Argon2PasswordHasher } from "@/infrastructure/crypto/argon2-password-hasher.js";

describe("Argon2PasswordHasher", () => {
  // argon2 is slow; reduce parameters for tests via env-injection in the implementation.
  it("hash/verify round-trip", async () => {
    const h = new Argon2PasswordHasher({
      memoryCost: 2 ** 10,
      timeCost: 2,
      parallelism: 1,
    });
    const hashed = await h.hash("hunter2");
    expect(hashed.value.startsWith("$argon2id$")).toBe(true);
    expect(await h.verify(hashed, "hunter2")).toBe(true);
    expect(await h.verify(hashed, "wrong")).toBe(false);
  });

  it("verifyAgainstSentinel does not throw on first call (lazy-builds the sentinel)", async () => {
    const h = new Argon2PasswordHasher({
      memoryCost: 2 ** 10,
      timeCost: 2,
      parallelism: 1,
    });
    await expect(h.verifyAgainstSentinel("x")).resolves.toBeUndefined();
    await expect(h.verifyAgainstSentinel("y")).resolves.toBeUndefined();
  });
});
