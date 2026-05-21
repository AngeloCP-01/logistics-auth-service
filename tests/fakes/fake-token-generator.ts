import type {
  GeneratedToken,
  TokenGenerator,
} from "@/application/ports/token-generator.js";

export class FakeTokenGenerator implements TokenGenerator {
  private counter = 0;
  generate(): GeneratedToken {
    this.counter += 1;
    const raw = `raw-token-${this.counter}-${"x".repeat(32)}`.padEnd(64, "x");
    const hash = `hash-of-${raw}`.padEnd(64, "h");
    return { raw, hash };
  }
}
