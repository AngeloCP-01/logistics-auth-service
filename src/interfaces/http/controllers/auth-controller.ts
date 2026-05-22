import type { NextFunction, Response, Router } from "express";
import { Router as makeRouter } from "express";

import type { ConfirmPasswordResetUseCase } from "../../../application/auth/confirm-password-reset.use-case.js";
import type { GetMeUseCase } from "../../../application/auth/get-me.use-case.js";
import type { LoginUseCase } from "../../../application/auth/login.use-case.js";
import type { LogoutUseCase } from "../../../application/auth/logout.use-case.js";
import type { RegisterUserUseCase } from "../../../application/auth/register-user.use-case.js";
import type { RequestPasswordResetUseCase } from "../../../application/auth/request-password-reset.use-case.js";
import type { ResendVerificationUseCase } from "../../../application/auth/resend-verification.use-case.js";
import type { RotateRefreshTokenUseCase } from "../../../application/auth/rotate-refresh-token.use-case.js";
import type { VerifyEmailUseCase } from "../../../application/auth/verify-email.use-case.js";
import type { JwtVerifier } from "../../../infrastructure/jwt/jwt-verifier.js";
import { jwtAuthMiddleware } from "../middleware/auth.js";
import type { AuthedRequest } from "../middleware/types.js";
import {
  LoginRequestSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RefreshTokenBodySchema,
  RegisterRequestSchema,
  VerifyEmailSchema,
} from "../request-schemas.js";

export interface AuthControllerDeps {
  register: RegisterUserUseCase;
  login: LoginUseCase;
  logout: LogoutUseCase;
  rotate: RotateRefreshTokenUseCase;
  requestReset: RequestPasswordResetUseCase;
  confirmReset: ConfirmPasswordResetUseCase;
  verifyEmail: VerifyEmailUseCase;
  resendVerification: ResendVerificationUseCase;
  getMe: GetMeUseCase;
  jwtVerifier: JwtVerifier;
  returnResetToken: boolean;
  returnVerificationToken: boolean;
}

export function buildAuthRouter(deps: AuthControllerDeps): Router {
  const router = makeRouter();
  const requireAuth = jwtAuthMiddleware(deps.jwtVerifier);

  router.post(
    "/register",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = RegisterRequestSchema.parse(req.body);
        const out = await deps.register.execute({
          ...body,
          correlationId: req.ctx.requestId,
        });
        res.setHeader("Location", "/v1/auth/me");
        res.status(201).json({ userId: out.userId });
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/login",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = LoginRequestSchema.parse(req.body);
        const out = await deps.login.execute({
          ...body,
          ip: req.ctx.ip,
          userAgent: req.ctx.userAgent,
        });
        res.status(200).json(out);
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/logout",
    requireAuth,
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = RefreshTokenBodySchema.parse(req.body);
        await deps.logout.execute({ refreshToken: body.refreshToken });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/refresh",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = RefreshTokenBodySchema.parse(req.body);
        const out = await deps.rotate.execute({
          refreshToken: body.refreshToken,
          ip: req.ctx.ip,
          userAgent: req.ctx.userAgent,
        });
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(out);
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/password-reset/request",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = PasswordResetRequestSchema.parse(req.body);
        const out = await deps.requestReset.execute({
          email: body.email,
          ip: req.ctx.ip,
          correlationId: req.ctx.requestId,
        });
        if (deps.returnResetToken && out.found && out.token && out.expiresAt) {
          res
            .status(202)
            .json({ token: out.token, expiresAt: out.expiresAt.toISOString() });
          return;
        }
        res.status(202).json({});
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/password-reset/confirm",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = PasswordResetConfirmSchema.parse(req.body);
        await deps.confirmReset.execute({
          ...body,
          correlationId: req.ctx.requestId,
        });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/verify-email",
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const body = VerifyEmailSchema.parse(req.body);
        await deps.verifyEmail.execute({
          token: body.token,
          correlationId: req.ctx.requestId,
        });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    "/verify-email/resend",
    requireAuth,
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const out = await deps.resendVerification.execute({
          userId: req.auth!.userId,
          correlationId: req.ctx.requestId,
        });
        if (deps.returnVerificationToken) {
          res
            .status(202)
            .json({ token: out.token, expiresAt: out.expiresAt.toISOString() });
          return;
        }
        res.status(202).json({});
      } catch (e) {
        next(e);
      }
    },
  );

  router.get(
    "/me",
    requireAuth,
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const out = await deps.getMe.execute({ userId: req.auth!.userId });
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

  return router;
}
