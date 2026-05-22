import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { JwtAccessTokenIssuer } from "@/infrastructure/jwt/jwt-access-token-issuer.js";
import { JwtVerifier } from "@/infrastructure/jwt/jwt-verifier.js";
import { UserId } from "@/domain/shared/ids.js";

const SECRET = "x".repeat(32);
const NOW = new Date("2026-05-21T10:00:00Z");

describe("JWT round-trip", () => {
  const issuer = new JwtAccessTokenIssuer({
    secret: SECRET,
    ttlSeconds: 900,
    audience: "logistics-platform",
    issuer: "auth-service",
  });
  const verifier = new JwtVerifier({
    secret: SECRET,
    audience: "logistics-platform",
    issuer: "auth-service",
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("issues then verifies a token", () => {
    const id = UserId.generate();
    const { token, expiresIn } = issuer.issue(
      { sub: id, role: "customer", email_verified: false },
      NOW,
    );
    expect(expiresIn).toBe(900);
    const claims = verifier.verify(token);
    expect(claims.sub).toBe(id);
    expect(claims.role).toBe("customer");
    expect(claims.email_verified).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const bad = new JwtAccessTokenIssuer({
      secret: "y".repeat(32),
      ttlSeconds: 900,
      audience: "logistics-platform",
      issuer: "auth-service",
    });
    const id = UserId.generate();
    const { token } = bad.issue(
      { sub: id, role: "customer", email_verified: false },
      NOW,
    );
    expect(() => verifier.verify(token)).toThrow();
  });

  it("rejects a token with wrong audience", () => {
    const wrongAud = new JwtAccessTokenIssuer({
      secret: SECRET,
      ttlSeconds: 900,
      audience: "other-platform",
      issuer: "auth-service",
    });
    const id = UserId.generate();
    const { token } = wrongAud.issue(
      { sub: id, role: "customer", email_verified: false },
      NOW,
    );
    expect(() => verifier.verify(token)).toThrow();
  });
});
