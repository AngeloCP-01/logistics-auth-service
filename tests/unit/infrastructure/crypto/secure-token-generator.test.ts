import { Sha256TokenHasher } from "@/infrastructure/crypto/sha256-token-hasher.js";
import { SecureTokenGenerator } from "@/infrastructure/crypto/secure-token-generator.js";

describe("SecureTokenGenerator", () => {
  const gen = new SecureTokenGenerator();
  const hasher = new Sha256TokenHasher();

  it("produces a base64url raw token of at least 32 chars", () => {
    const t = gen.generate();
    expect(t.raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.raw.length).toBeGreaterThanOrEqual(32);
  });
  it("hash field equals SHA-256 of raw", () => {
    const t = gen.generate();
    expect(t.hash).toBe(hasher.hash(t.raw));
  });
  it("two successive generations differ", () => {
    const a = gen.generate();
    const b = gen.generate();
    expect(a.raw).not.toBe(b.raw);
  });
});
