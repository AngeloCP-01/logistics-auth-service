import type { DomainEvent } from "../shared/domain-event.js";
import type { Email } from "../shared/email.js";
import { InvariantViolationError } from "../shared/errors.js";
import type { HashedPassword } from "../shared/hashed-password.js";
import type { UserId } from "../shared/ids.js";
import {
  EmailVerificationRequested,
  EmailVerified,
  PasswordChanged,
  RoleChanged,
  UserRegistered,
} from "./events.js";
import type { Role } from "./role.js";
import type { UserStatus } from "./user-status.js";

export class User {
  private events: DomainEvent[] = [];

  private constructor(
    readonly id: UserId,
    readonly email: Email,
    private _passwordHash: HashedPassword,
    private _role: Role,
    private _status: UserStatus,
    private _emailVerifiedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static register(input: {
    id: UserId;
    email: Email;
    passwordHash: HashedPassword;
    role: Role;
    now: Date;
  }): User {
    const user = new User(
      input.id,
      input.email,
      input.passwordHash,
      input.role,
      "active",
      null,
      input.now,
    );
    user.events.push(
      new UserRegistered(input.id, input.email, input.role, input.now),
    );
    return user;
  }

  static fromPersistence(input: {
    id: UserId;
    email: Email;
    passwordHash: HashedPassword;
    role: Role;
    status: UserStatus;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }): User {
    return new User(
      input.id,
      input.email,
      input.passwordHash,
      input.role,
      input.status,
      input.emailVerifiedAt,
      input.createdAt,
    );
  }

  get passwordHash(): HashedPassword {
    return this._passwordHash;
  }
  get role(): Role {
    return this._role;
  }
  get status(): UserStatus {
    return this._status;
  }
  get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }

  isActive(): boolean {
    return this._status === "active";
  }

  isEmailVerified(): boolean {
    return this._emailVerifiedAt !== null;
  }

  changePassword(newHash: HashedPassword, now: Date): void {
    this._passwordHash = newHash;
    this.events.push(new PasswordChanged(this.id, this.email, now, now));
  }

  changeRole(newRole: Role, changedBy: UserId, now: Date): void {
    if (newRole === this._role) {
      throw new InvariantViolationError("Role unchanged");
    }
    const old = this._role;
    this._role = newRole;
    this.events.push(
      new RoleChanged(this.id, old, newRole, changedBy, now, now),
    );
  }

  markEmailVerified(now: Date): void {
    if (this._emailVerifiedAt !== null) return;
    this._emailVerifiedAt = now;
    this.events.push(new EmailVerified(this.id, this.email, now, now));
  }

  recordEmailVerificationRequested(
    tokenPlain: string,
    expiresAt: Date,
    now: Date,
  ): void {
    this.events.push(
      new EmailVerificationRequested(
        this.id,
        this.email,
        tokenPlain,
        expiresAt,
        now,
      ),
    );
  }

  pullEvents(): DomainEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
