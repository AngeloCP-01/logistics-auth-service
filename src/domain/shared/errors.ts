export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly status: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = "invalid_credentials";
  readonly status = 401;
  constructor() {
    super("Invalid credentials");
  }
}

export class TokenExpiredError extends DomainError {
  readonly code = "token_expired";
  readonly status = 401;
  constructor() {
    super("Token expired or unknown");
  }
}

export class TokenReusedError extends DomainError {
  readonly code = "token_reused";
  readonly status = 401;
  constructor() {
    super("Refresh token reused after rotation");
  }
}

export class EmailAlreadyExistsError extends DomainError {
  readonly code = "email_already_exists";
  readonly status = 409;
  constructor(public readonly email: string) {
    super(`Email already registered: ${email}`);
  }
}

export class AccountLockedError extends DomainError {
  readonly code = "account_locked";
  readonly status = 423;
  constructor(public readonly retryAfterSeconds: number) {
    super(`Account locked; retry after ${retryAfterSeconds}s`);
  }
}

export class InvalidResetTokenError extends DomainError {
  readonly code = "invalid_reset_token";
  readonly status = 400;
  constructor() {
    super("Reset token is invalid, expired, or already used");
  }
}

export class InvalidVerificationTokenError extends DomainError {
  readonly code = "invalid_verification_token";
  readonly status = 400;
  constructor() {
    super("Verification token is invalid, expired, or already used");
  }
}

export class WeakPasswordError extends DomainError {
  readonly code = "weak_password";
  readonly status = 422;
  constructor(public readonly reason: string) {
    super(`Weak password: ${reason}`);
  }
}

export class AlreadyVerifiedError extends DomainError {
  readonly code = "already_verified";
  readonly status = 409;
  constructor() {
    super("Email is already verified");
  }
}

export class ForbiddenSelfRoleChangeError extends DomainError {
  readonly code = "forbidden_self_role_change";
  readonly status = 403;
  constructor() {
    super("An admin cannot change their own role");
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = "user_not_found";
  readonly status = 404;
  constructor(public readonly id: string) {
    super(`User not found: ${id}`);
  }
}

export class RateLimitedError extends DomainError {
  readonly code = "rate_limited";
  readonly status = 429;
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited; retry after ${retryAfterSeconds}s`);
  }
}

/** Thrown when an entity's invariant is violated by a caller that didn't check state first.
 *  These should be unreachable in production if use-cases obey the entity's contract.
 *  Status 500 because reaching one IS a programmer bug, not user input. */
export class InvariantViolationError extends DomainError {
  readonly code = "invariant_violation";
  readonly status = 500;
}
