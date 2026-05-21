import type { RefreshTokenId, UserId } from "../shared/ids.js";
import type { RefreshToken } from "./refresh-token.js";

export interface RefreshTokenRepository {
  byTokenHash(hash: string): Promise<RefreshToken | null>;
  byId(id: RefreshTokenId): Promise<RefreshToken | null>;
  save(token: RefreshToken): Promise<void>;
  /** Walk replaced_by_id forward from `tokenId` and revoke every token in the chain that's not already revoked. */
  revokeFamilyForward(tokenId: RefreshTokenId, now: Date): Promise<void>;
  /** Revoke every non-revoked refresh token for the given user. Used on password change. */
  revokeAllForUser(userId: UserId, now: Date): Promise<void>;
}
