import express, { Express } from "express";
import { Redis } from "ioredis";
import { PrismaClient } from "@prisma/client";

import { ConfirmPasswordResetUseCase } from "@/application/auth/confirm-password-reset.use-case.js";
import { GetMeUseCase } from "@/application/auth/get-me.use-case.js";
import { LoginUseCase } from "@/application/auth/login.use-case.js";
import { LogoutUseCase } from "@/application/auth/logout.use-case.js";
import { RegisterUserUseCase } from "@/application/auth/register-user.use-case.js";
import { RequestPasswordResetUseCase } from "@/application/auth/request-password-reset.use-case.js";
import { ResendVerificationUseCase } from "@/application/auth/resend-verification.use-case.js";
import { RotateRefreshTokenUseCase } from "@/application/auth/rotate-refresh-token.use-case.js";
import { VerifyEmailUseCase } from "@/application/auth/verify-email.use-case.js";
import { ChangeUserRoleUseCase } from "@/application/admin/change-user-role.use-case.js";
import { UnlockUserUseCase } from "@/application/admin/unlock-user.use-case.js";
import { SystemClock } from "@/domain/shared/clock.js";
import { Argon2PasswordHasher } from "@/infrastructure/crypto/argon2-password-hasher.js";
import { SecureTokenGenerator } from "@/infrastructure/crypto/secure-token-generator.js";
import { Sha256TokenHasher } from "@/infrastructure/crypto/sha256-token-hasher.js";
import { JwtAccessTokenIssuer } from "@/infrastructure/jwt/jwt-access-token-issuer.js";
import { JwtVerifier } from "@/infrastructure/jwt/jwt-verifier.js";
import { RabbitMqEventBus } from "@/infrastructure/messaging/rabbitmq-event-bus.js";
import { PrismaEmailVerificationTokenRepository } from "@/infrastructure/persistence/prisma-email-verification-token-repository.js";
import { PrismaPasswordResetTokenRepository } from "@/infrastructure/persistence/prisma-password-reset-token-repository.js";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/prisma-refresh-token-repository.js";
import { PrismaUserRepository } from "@/infrastructure/persistence/prisma-user-repository.js";
import { PrismaUnitOfWork } from "@/infrastructure/persistence/prisma-unit-of-work.js";
import { RedisRateLimiter } from "@/infrastructure/rate-limit/redis-rate-limiter.js";
import { errorMiddlewareExpress } from "@/interfaces/http/middleware/error.js";
import { requestIdMiddleware } from "@/interfaces/http/middleware/request-id.js";
import { mountRoutes } from "@/interfaces/http/routes.js";

export interface TestAppDeps {
  prisma: PrismaClient;
  redis: Redis;
  rabbitUrl: string;
  jwtSecret: string;
}

export interface BuiltTestApp {
  app: Express;
  eventBus: RabbitMqEventBus;
  cleanup: () => Promise<void>;
}

export async function buildTestApp(deps: TestAppDeps): Promise<BuiltTestApp> {
  const clock = new SystemClock();
  const uow = new PrismaUnitOfWork(deps.prisma);
  // argon2@0.41 enforces timeCost >= 2 (security floor). The plan template's
  // timeCost: 1 fails at runtime; raise to 2. memoryCost stays at 1 MiB so
  // per-hash cost is still ~10ms — fast enough for the integration suite.
  const hasher = new Argon2PasswordHasher({
    memoryCost: 2 ** 10,
    timeCost: 2,
    parallelism: 1,
  });
  const tokenGen = new SecureTokenGenerator();
  const tokenHasher = new Sha256TokenHasher();
  const rateLimiter = new RedisRateLimiter(deps.redis);
  const eventBus = new RabbitMqEventBus(deps.rabbitUrl);
  await eventBus.connect();

  const users = new PrismaUserRepository(deps.prisma);
  const refreshTokens = new PrismaRefreshTokenRepository(deps.prisma);
  const resetTokens = new PrismaPasswordResetTokenRepository(deps.prisma);
  const verificationTokens = new PrismaEmailVerificationTokenRepository(
    deps.prisma,
  );

  const accessTokens = new JwtAccessTokenIssuer({
    secret: deps.jwtSecret,
    ttlSeconds: 900,
    audience: "logistics-platform",
    issuer: "auth-service",
  });
  const jwtVerifier = new JwtVerifier({
    secret: deps.jwtSecret,
    audience: "logistics-platform",
    issuer: "auth-service",
  });

  const register = new RegisterUserUseCase(
    users,
    verificationTokens,
    hasher,
    tokenGen,
    eventBus,
    clock,
    uow,
  );
  const login = new LoginUseCase(
    users,
    refreshTokens,
    hasher,
    tokenGen,
    rateLimiter,
    accessTokens,
    clock,
    uow,
    {
      refreshTtlDays: 30,
      lockoutThreshold: 5,
      lockoutWindowSeconds: 900,
    },
  );
  const logout = new LogoutUseCase(refreshTokens, tokenHasher, clock);
  const rotate = new RotateRefreshTokenUseCase(
    users,
    refreshTokens,
    tokenGen,
    tokenHasher,
    accessTokens,
    clock,
    uow,
    { refreshTtlDays: 30 },
  );
  const requestReset = new RequestPasswordResetUseCase(
    users,
    resetTokens,
    tokenGen,
    rateLimiter,
    eventBus,
    clock,
    uow,
    {
      resetTtlMinutes: 15,
      perEmailCooldownSeconds: 60,
      perIpDailyLimit: 10,
    },
  );
  const confirmReset = new ConfirmPasswordResetUseCase(
    users,
    resetTokens,
    refreshTokens,
    hasher,
    tokenHasher,
    eventBus,
    clock,
    uow,
  );
  const verifyEmail = new VerifyEmailUseCase(
    users,
    verificationTokens,
    tokenHasher,
    eventBus,
    clock,
    uow,
  );
  const resendVerification = new ResendVerificationUseCase(
    users,
    verificationTokens,
    tokenGen,
    rateLimiter,
    eventBus,
    clock,
    uow,
    {
      verificationTtlHours: 24,
      perUserCooldownSeconds: 60,
    },
  );
  const getMe = new GetMeUseCase(users);
  const changeRole = new ChangeUserRoleUseCase(users, eventBus, clock, uow);
  const unlockUser = new UnlockUserUseCase(users, rateLimiter);

  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(requestIdMiddleware);
  mountRoutes(app, {
    authDeps: {
      register,
      login,
      logout,
      rotate,
      requestReset,
      confirmReset,
      verifyEmail,
      resendVerification,
      getMe,
      jwtVerifier,
      returnResetToken: true,
      returnVerificationToken: true,
    },
    adminDeps: { changeRole, unlockUser, jwtVerifier },
    healthDeps: { prisma: deps.prisma, rabbitHealthy: () => true },
  });
  app.use(errorMiddlewareExpress);

  return {
    app,
    eventBus,
    cleanup: async () => {
      await eventBus.close();
    },
  };
}
