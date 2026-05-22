import { Sha256TokenHasher } from "@/infrastructure/crypto/sha256-token-hasher.js";

describe("Sha256TokenHasher", () => {
  const h = new Sha256TokenHasher();
  it("produces a 64-hex-char digest", () => {
    const out = h.hash("hello");
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic", () => {
    expect(h.hash("x")).toBe(h.hash("x"));
  });
  it("different inputs produce different outputs", () => {
    expect(h.hash("x")).not.toBe(h.hash("y"));
  });
});
