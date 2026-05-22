import type { Clock } from "../../domain/shared/clock.js";
import { Email } from "../../domain/shared/email.js";
import { UserId } from "../../domain/shared/ids.js";
import { User } from "../../domain/user/user.js";
import type { UserRepository } from "../../domain/user/user-repository.js";
import type { PasswordHasher } from "../../application/ports/password-hasher.js";

export interface SeedAdminLogger {
  info: (event: string, ctx?: unknown) => void;
  warn: (event: string, ctx?: unknown) => void;
}

export interface SeedAdminInput {
  email: string;
  password: string;
  users: UserRepository;
  hasher: PasswordHasher;
  clock: Clock;
  logger: SeedAdminLogger;
}

export async function seedAdmin(input: SeedAdminInput): Promise<void> {
  if (!input.email || !input.password) {
    input.logger.info("seed_admin_skipped", { reason: "missing_env" });
    return;
  }
  const email = Email.of(input.email);
  const existing = await input.users.byEmail(email);
  if (existing) {
    input.logger.info("seed_admin_skipped", {
      reason: "already_exists",
      userId: existing.id,
    });
    return;
  }
  const now = input.clock.now();
  const hash = await input.hasher.hash(input.password);
  const user = User.register({
    id: UserId.generate(),
    email,
    passwordHash: hash,
    role: "admin",
    now,
  });
  // Drop the UserRegistered/EmailVerificationRequested events — seeded admin
  // does not need to send a welcome / verification email.
  user.pullEvents();
  user.markEmailVerified(now);
  user.pullEvents();
  await input.users.save(user);
  input.logger.info("seed_admin_created", { userId: user.id });
}
