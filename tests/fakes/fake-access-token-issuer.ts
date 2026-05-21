import type {
  AccessTokenIssuer,
  AccessTokenPayload,
} from "@/application/ports/access-token-issuer.js";

export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  issued: AccessTokenPayload[] = [];
  issue(
    payload: AccessTokenPayload,
    _now: Date,
  ): { token: string; expiresIn: number } {
    this.issued.push(payload);
    return { token: `access.${payload.sub}.${payload.role}`, expiresIn: 900 };
  }
}
