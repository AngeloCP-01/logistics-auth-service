import jwt from "jsonwebtoken";

import type {
  AccessTokenIssuer,
  AccessTokenPayload,
} from "../../application/ports/access-token-issuer.js";

export interface JwtAccessTokenIssuerConfig {
  secret: string;
  ttlSeconds: number;
  audience: string;
  issuer: string;
}

export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  constructor(private readonly cfg: JwtAccessTokenIssuerConfig) {}

  issue(
    payload: AccessTokenPayload,
    now: Date,
  ): { token: string; expiresIn: number } {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + this.cfg.ttlSeconds;
    const token = jwt.sign(
      {
        sub: payload.sub,
        role: payload.role,
        email_verified: payload.email_verified,
        iat,
        exp,
        aud: this.cfg.audience,
        iss: this.cfg.issuer,
      },
      this.cfg.secret,
      { algorithm: "HS256" },
    );
    return { token, expiresIn: this.cfg.ttlSeconds };
  }
}
