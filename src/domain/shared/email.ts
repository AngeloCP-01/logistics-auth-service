import { DomainError } from "./errors.js";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class InvalidEmailError extends DomainError {
  readonly code = "invalid_email";
  readonly status = 400;
  constructor(value: string) {
    super(`Invalid email: ${value}`);
  }
}

export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    if (typeof raw !== "string" || raw.length === 0 || !EMAIL_REGEX.test(raw)) {
      throw new InvalidEmailError(raw);
    }
    return new Email(raw.toLowerCase());
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
