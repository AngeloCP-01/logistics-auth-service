export interface TokenHasher {
  /** Hash an opaque random refresh/reset/verification token. Returns hex SHA-256. */
  hash(raw: string): string;
}
