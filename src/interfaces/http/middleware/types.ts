import type { Request } from "express";

import type { UserId } from "../../../domain/shared/ids.js";
import type { Role } from "../../../domain/user/role.js";

export interface AuthContext {
  userId: UserId;
  role: Role;
  emailVerified: boolean;
}

export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string;
}

export interface AuthedRequest extends Request {
  ctx: RequestContext;
  auth?: AuthContext;
}
