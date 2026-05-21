import { DomainEvent } from "../shared/domain-event.js";
import type { UserId } from "../shared/ids.js";
import type { Email } from "../shared/email.js";
import type { Role } from "./role.js";

export class UserRegistered extends DomainEvent {
  readonly eventType = "user.registered";
  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly role: Role,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export class EmailVerificationRequested extends DomainEvent {
  readonly eventType = "user.email_verification_requested";
  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly tokenPlain: string,
    readonly expiresAt: Date,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export class EmailVerified extends DomainEvent {
  readonly eventType = "user.email_verified";
  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly verifiedAt: Date,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export class PasswordResetRequested extends DomainEvent {
  readonly eventType = "user.password_reset_requested";
  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly tokenPlain: string,
    readonly expiresAt: Date,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export class PasswordChanged extends DomainEvent {
  readonly eventType = "user.password_changed";
  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly changedAt: Date,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export class RoleChanged extends DomainEvent {
  readonly eventType = "user.role_changed";
  constructor(
    readonly userId: UserId,
    readonly oldRole: Role,
    readonly newRole: Role,
    readonly changedBy: UserId,
    readonly changedAt: Date,
    readonly occurredAt: Date,
  ) {
    super();
  }
}
