export interface GeneratedToken {
  raw: string;
  hash: string;
}

export interface TokenGenerator {
  generate(): GeneratedToken;
}
