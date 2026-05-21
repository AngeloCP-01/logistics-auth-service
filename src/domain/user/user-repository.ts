import type { Email } from "../shared/email.js";
import type { UserId } from "../shared/ids.js";
import type { User } from "./user.js";

export interface UserRepository {
  byId(id: UserId): Promise<User | null>;
  byEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
