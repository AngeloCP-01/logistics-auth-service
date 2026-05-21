import {
  AccountLockedError,
  AlreadyVerifiedError,
  DomainError,
  EmailAlreadyExistsError,
  ForbiddenSelfRoleChangeError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidVerificationTokenError,
  RateLimitedError,
  TokenExpiredError,
  TokenReusedError,
  UserNotFoundError,
  WeakPasswordError,
} from "@/domain/shared/errors.js";

describe("DomainError hierarchy", () => {
  const cases: Array<[new (...args: never[]) => DomainError, string, number]> =
    [
      [InvalidCredentialsError as never, "invalid_credentials", 401],
      [TokenExpiredError as never, "token_expired", 401],
      [TokenReusedError as never, "token_reused", 401],
      [EmailAlreadyExistsError as never, "email_already_exists", 409],
      [AccountLockedError as never, "account_locked", 423],
      [InvalidResetTokenError as never, "invalid_reset_token", 400],
      [
        InvalidVerificationTokenError as never,
        "invalid_verification_token",
        400,
      ],
      [WeakPasswordError as never, "weak_password", 422],
      [AlreadyVerifiedError as never, "already_verified", 409],
      [
        ForbiddenSelfRoleChangeError as never,
        "forbidden_self_role_change",
        403,
      ],
      [UserNotFoundError as never, "user_not_found", 404],
    ];

  for (const [Ctor, code, status] of cases) {
    it(`${Ctor.name} has code=${code} status=${status}`, () => {
      const e =
        Ctor === (UserNotFoundError as never)
          ? new UserNotFoundError("00000000-0000-0000-0000-000000000000")
          : Ctor === (InvalidCredentialsError as never)
            ? new InvalidCredentialsError()
            : Ctor === (TokenExpiredError as never)
              ? new TokenExpiredError()
              : Ctor === (TokenReusedError as never)
                ? new TokenReusedError()
                : Ctor === (EmailAlreadyExistsError as never)
                  ? new EmailAlreadyExistsError("a@b.com")
                  : Ctor === (AccountLockedError as never)
                    ? new AccountLockedError(60)
                    : Ctor === (InvalidResetTokenError as never)
                      ? new InvalidResetTokenError()
                      : Ctor === (InvalidVerificationTokenError as never)
                        ? new InvalidVerificationTokenError()
                        : Ctor === (WeakPasswordError as never)
                          ? new WeakPasswordError("too short")
                          : Ctor === (AlreadyVerifiedError as never)
                            ? new AlreadyVerifiedError()
                            : new ForbiddenSelfRoleChangeError();
      expect(e.code).toBe(code);
      expect(e.status).toBe(status);
      expect(e).toBeInstanceOf(DomainError);
    });
  }

  it("AccountLockedError exposes retryAfterSeconds", () => {
    const e = new AccountLockedError(123);
    expect(e.retryAfterSeconds).toBe(123);
  });

  it("RateLimitedError exposes retryAfterSeconds", () => {
    const e = new RateLimitedError(45);
    expect(e.retryAfterSeconds).toBe(45);
    expect(e.code).toBe("rate_limited");
    expect(e.status).toBe(429);
  });
});
