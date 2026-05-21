import type { UserId } from "../../domain/shared/ids.js";
import type { Role } from "../../domain/user/role.js";

export interface AccessTokenPayload {
  sub: UserId;
  role: Role;
  email_verified: boolean;
}

export interface AccessTokenIssuer {
  /** Returns a signed JWT and the expiresIn seconds. */
  issue(
    payload: AccessTokenPayload,
    now: Date,
  ): { token: string; expiresIn: number };
}
