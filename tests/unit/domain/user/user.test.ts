import { Email } from "@/domain/shared/email.js";
import { HashedPassword } from "@/domain/shared/hashed-password.js";
import { UserId } from "@/domain/shared/ids.js";
import { User } from "@/domain/user/user.js";
import {
  EmailVerificationRequested,
  EmailVerified,
  PasswordChanged,
  RoleChanged,
  UserRegistered,
} from "@/domain/user/events.js";

const HASH = "$argon2id$v=19$m=65536,t=3,p=4$abc$def";
const NOW = new Date("2026-05-21T10:00:00Z");
const LATER = new Date("2026-05-21T11:00:00Z");

function makeUser(): User {
  return User.register({
    id: UserId.generate(),
    email: Email.of("user@example.com"),
    passwordHash: HashedPassword.fromHash(HASH),
    role: "customer",
    now: NOW,
  });
}

describe("User", () => {
  describe("register", () => {
    it("creates a user in active status, unverified, with the given role", () => {
      const user = makeUser();
      expect(user.role).toBe("customer");
      expect(user.status).toBe("active");
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.isActive()).toBe(true);
    });

    it("pushes a UserRegistered event", () => {
      const user = makeUser();
      const events = user.pullEvents();
      expect(events.some((e) => e instanceof UserRegistered)).toBe(true);
    });

    it("pulled events list is empty on second pull", () => {
      const user = makeUser();
      user.pullEvents();
      expect(user.pullEvents()).toEqual([]);
    });
  });

  describe("changePassword", () => {
    it("updates the password hash and pushes PasswordChanged", () => {
      const user = makeUser();
      user.pullEvents();
      const newHash = HashedPassword.fromHash(
        "$argon2id$v=19$m=65536,t=3,p=4$xyz$abc",
      );
      user.changePassword(newHash, LATER);
      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PasswordChanged);
    });
  });

  describe("changeRole", () => {
    it("updates role and pushes RoleChanged", () => {
      const user = makeUser();
      user.pullEvents();
      const adminId = UserId.generate();
      user.changeRole("driver", adminId, LATER);
      expect(user.role).toBe("driver");
      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      const ev = events[0] as RoleChanged;
      expect(ev.oldRole).toBe("customer");
      expect(ev.newRole).toBe("driver");
      expect(ev.changedBy).toBe(adminId);
    });

    it("throws when the new role equals the current role", () => {
      const user = makeUser();
      const adminId = UserId.generate();
      expect(() => user.changeRole("customer", adminId, LATER)).toThrow(
        /role unchanged/i,
      );
    });
  });

  describe("markEmailVerified", () => {
    it("sets emailVerifiedAt and pushes EmailVerified on first call", () => {
      const user = makeUser();
      user.pullEvents();
      user.markEmailVerified(LATER);
      expect(user.emailVerifiedAt).toEqual(LATER);
      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EmailVerified);
    });

    it("is a no-op on second call (no event)", () => {
      const user = makeUser();
      user.pullEvents();
      user.markEmailVerified(LATER);
      user.pullEvents();
      user.markEmailVerified(new Date("2026-05-21T12:00:00Z"));
      expect(user.emailVerifiedAt).toEqual(LATER); // first value preserved
      expect(user.pullEvents()).toEqual([]);
    });
  });

  describe("emailVerificationRequested", () => {
    it("collects a fresh EmailVerificationRequested event with token data from the caller", () => {
      const user = makeUser();
      user.pullEvents();
      user.recordEmailVerificationRequested(
        "a".repeat(32),
        new Date("2026-05-22T10:00:00Z"),
        NOW,
      );
      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EmailVerificationRequested);
    });
  });
});
