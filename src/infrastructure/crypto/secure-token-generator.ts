import { randomBytes } from "node:crypto";
import type {
  GeneratedToken,
  TokenGenerator,
} from "../../application/ports/token-generator.js";
import { Sha256TokenHasher } from "./sha256-token-hasher.js";

export class SecureTokenGenerator implements TokenGenerator {
  private readonly hasher = new Sha256TokenHasher();

  generate(): GeneratedToken {
    const raw = randomBytes(32).toString("base64url");
    return { raw, hash: this.hasher.hash(raw) };
  }
}
