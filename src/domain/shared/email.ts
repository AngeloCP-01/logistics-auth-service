const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class InvalidEmailError extends Error {
  constructor(value: string) {
    super(`Invalid email: ${value}`);
    this.name = "InvalidEmailError";
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
