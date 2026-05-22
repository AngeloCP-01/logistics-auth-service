import jwt from "jsonwebtoken";

import { UserId } from "../../domain/shared/ids.js";
import type { Role } from "../../domain/user/role.js";

export interface JwtVerifierConfig {
  secret: string;
  audience: string;
  issuer: string;
}

export interface VerifiedClaims {
  sub: UserId;
  role: Role;
  email_verified: boolean;
}

export class JwtVerifier {
  constructor(private readonly cfg: JwtVerifierConfig) {}

  verify(token: string): VerifiedClaims {
    const decoded = jwt.verify(token, this.cfg.secret, {
      algorithms: ["HS256"],
      audience: this.cfg.audience,
      issuer: this.cfg.issuer,
    }) as { sub: string; role: Role; email_verified: boolean };
    return {
      sub: UserId.of(decoded.sub),
      role: decoded.role,
      email_verified: decoded.email_verified,
    };
  }
}
