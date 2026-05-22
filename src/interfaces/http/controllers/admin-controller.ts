import type { NextFunction, Response, Router } from "express";
import { Router as makeRouter } from "express";

import type { ChangeUserRoleUseCase } from "../../../application/admin/change-user-role.use-case.js";
import type { UnlockUserUseCase } from "../../../application/admin/unlock-user.use-case.js";
import { UserId } from "../../../domain/shared/ids.js";
import type { JwtVerifier } from "../../../infrastructure/jwt/jwt-verifier.js";
import { jwtAuthMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/role-guard.js";
import type { AuthedRequest } from "../middleware/types.js";
import { ChangeRoleSchema, UserIdParamSchema } from "../request-schemas.js";

export interface AdminControllerDeps {
  changeRole: ChangeUserRoleUseCase;
  unlockUser: UnlockUserUseCase;
  jwtVerifier: JwtVerifier;
}

export function buildAdminRouter(deps: AdminControllerDeps): Router {
  const router = makeRouter();
  router.use(jwtAuthMiddleware(deps.jwtVerifier));
  router.use(requireRole("admin"));

  router.post(
    "/users/:id/role",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = UserIdParamSchema.parse(req.params);
        const body = ChangeRoleSchema.parse(req.body);
        const out = await deps.changeRole.execute({
          targetUserId: UserId.of(id),
          newRole: body.role,
          actingAdminId: req.auth!.userId,
          correlationId: req.ctx.requestId,
        });
        res.status(200).json({
          id: out.id,
          email: out.email,
          role: out.role,
          emailVerified: out.emailVerified,
          status: out.status,
          createdAt: out.createdAt.toISOString(),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/users/:id/unlock",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = UserIdParamSchema.parse(req.params);
        await deps.unlockUser.execute({ targetUserId: UserId.of(id) });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );

  return router;
}
