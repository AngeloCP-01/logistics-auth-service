import { randomUUID } from "node:crypto";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Brand<K, T extends string> = K & { readonly __brand: T };

export type UserId = Brand<string, "UserId">;
export type RefreshTokenId = Brand<string, "RefreshTokenId">;
export type ResetTokenId = Brand<string, "ResetTokenId">;
export type VerificationTokenId = Brand<string, "VerificationTokenId">;

function assertUuid(value: string, name: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`${name} must be a UUID, got: ${value}`);
  }
}

export const UserId = {
  generate: (): UserId => randomUUID() as UserId,
  of: (value: string): UserId => {
    assertUuid(value, "UserId");
    return value as UserId;
  },
};

export const RefreshTokenId = {
  generate: (): RefreshTokenId => randomUUID() as RefreshTokenId,
  of: (value: string): RefreshTokenId => {
    assertUuid(value, "RefreshTokenId");
    return value as RefreshTokenId;
  },
};

export const ResetTokenId = {
  generate: (): ResetTokenId => randomUUID() as ResetTokenId,
  of: (value: string): ResetTokenId => {
    assertUuid(value, "ResetTokenId");
    return value as ResetTokenId;
  },
};

export const VerificationTokenId = {
  generate: (): VerificationTokenId => randomUUID() as VerificationTokenId,
  of: (value: string): VerificationTokenId => {
    assertUuid(value, "VerificationTokenId");
    return value as VerificationTokenId;
  },
};
