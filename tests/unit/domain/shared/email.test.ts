import { Email, InvalidEmailError } from "@/domain/shared/email.js";

describe("Email", () => {
  it("accepts a valid email", () => {
    const e = Email.of("user@example.com");
    expect(e.value).toBe("user@example.com");
  });

  it("lowercases the input", () => {
    const e = Email.of("USER@Example.COM");
    expect(e.value).toBe("user@example.com");
  });

  it("rejects an empty string", () => {
    expect(() => Email.of("")).toThrow(InvalidEmailError);
  });

  it("rejects a value without an @", () => {
    expect(() => Email.of("noatsign")).toThrow(InvalidEmailError);
  });

  it("rejects a value without a domain TLD", () => {
    expect(() => Email.of("user@nodomain")).toThrow(InvalidEmailError);
  });

  it("two emails with the same canonical form are equal", () => {
    expect(Email.of("a@b.com").equals(Email.of("A@B.COM"))).toBe(true);
  });

  it("different emails are not equal", () => {
    expect(Email.of("a@b.com").equals(Email.of("c@b.com"))).toBe(false);
  });
});
