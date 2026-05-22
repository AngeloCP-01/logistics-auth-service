import { createHash } from "node:crypto";
import type { TokenHasher } from "../../application/ports/token-hasher.js";

export class Sha256TokenHasher implements TokenHasher {
  hash(raw: string): string {
    return createHash("sha256").update(raw, "utf8").digest("hex");
  }
}
