import type { Email } from "@/domain/shared/email.js";
import type { UserId } from "@/domain/shared/ids.js";
import type { User } from "@/domain/user/user.js";
import type { UserRepository } from "@/domain/user/user-repository.js";

export class InMemoryUserRepository implements UserRepository {
  private byIdMap = new Map<string, User>();
  private byEmailMap = new Map<string, User>();

  async byId(id: UserId): Promise<User | null> {
    return this.byIdMap.get(id) ?? null;
  }
  async byEmail(email: Email): Promise<User | null> {
    return this.byEmailMap.get(email.value) ?? null;
  }
  async save(user: User): Promise<void> {
    this.byIdMap.set(user.id, user);
    this.byEmailMap.set(user.email.value, user);
  }
  all(): User[] {
    return [...this.byIdMap.values()];
  }
}
