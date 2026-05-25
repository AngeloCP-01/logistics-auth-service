import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { Redis } from "ioredis";

import { loadEnv } from "./config/env.js";

import { SystemClock } from "./domain/shared/clock.js";

import { ConfirmPasswordResetUseCase } from "./application/auth/confirm-password-reset.use-case.js";
import { GetMeUseCase } from "./application/auth/get-me.use-case.js";
import { LoginUseCase } from "./application/auth/login.use-case.js";
import { LogoutUseCase } from "./application/auth/logout.use-case.js";
import { RegisterUserUseCase } from "./application/auth/register-user.use-case.js";
import { RequestPasswordResetUseCase } from "./application/auth/request-password-reset.use-case.js";
import { ResendVerificationUseCase } from "./application/auth/resend-verification.use-case.js";
import { RotateRefreshTokenUseCase } from "./application/auth/rotate-refresh-token.use-case.js";
import { VerifyEmailUseCase } from "./application/auth/verify-email.use-case.js";
import { ChangeUserRoleUseCase } from "./application/admin/change-user-role.use-case.js";
import { UnlockUserUseCase } from "./application/admin/unlock-user.use-case.js";

import { Argon2PasswordHasher } from "./infrastructure/crypto/argon2-password-hasher.js";
import { SecureTokenGenerator } from "./infrastructure/crypto/secure-token-generator.js";
import { Sha256TokenHasher } from "./infrastructure/crypto/sha256-token-hasher.js";
import { JwtAccessTokenIssuer } from "./infrastructure/jwt/jwt-access-token-issuer.js";
import { JwtVerifier } from "./infrastructure/jwt/jwt-verifier.js";
import { RabbitMqEventBus } from "./infrastructure/messaging/rabbitmq-event-bus.js";
import { PrismaEmailVerificationTokenRepository } from "./infrastructure/persistence/prisma-email-verification-token-repository.js";
import { PrismaPasswordResetTokenRepository } from "./infrastructure/persistence/prisma-password-reset-token-repository.js";
import { PrismaRefreshTokenRepository } from "./infrastructure/persistence/prisma-refresh-token-repository.js";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user-repository.js";
import { PrismaUnitOfWork } from "./infrastructure/persistence/prisma-unit-of-work.js";
import { buildPrismaClient } from "./infrastructure/persistence/prisma-client.js";
import { RedisRateLimiter } from "./infrastructure/rate-limit/redis-rate-limiter.js";
import { seedAdmin } from "./infrastructure/bootstrap/seed-admin.js";

import { errorMiddlewareExpress } from "./interfaces/http/middleware/error.js";
import { requestIdMiddleware } from "./interfaces/http/middleware/request-id.js";
import { mountRoutes } from "./interfaces/http/routes.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: env.LOG_SERVICE_NAME },
  });

  const prisma = buildPrismaClient(env.AUTH_DB_URL);
  await prisma.$connect();

  const redis = new Redis(env.REDIS_URL);
  await redis.ping();

  const eventBus = new RabbitMqEventBus(env.RABBITMQ_URL);
  await eventBus.connect();

  const clock = new SystemClock();
  const uow = new PrismaUnitOfWork(prisma);
  const hasher = new Argon2PasswordHasher();
  const tokenGen = new SecureTokenGenerator();
  const tokenHasher = new Sha256TokenHasher();
  const rateLimiter = new RedisRateLimiter(redis);

  const users = new PrismaUserRepository(prisma);
  const refreshTokens = new PrismaRefreshTokenRepository(prisma);
  const resetTokens = new PrismaPasswordResetTokenRepository(prisma);
  const verificationTokens = new PrismaEmailVerificationTokenRepository(prisma);

  const accessTokens = new JwtAccessTokenIssuer({
    secret: env.AUTH_JWT_SECRET,
    ttlSeconds: 900,
    audience: "logistics-platform",
    issuer: "auth-service",
  });
  const jwtVerifier = new JwtVerifier({
    secret: env.AUTH_JWT_SECRET,
    audience: "logistics-platform",
    issuer: "auth-service",
  });

  await seedAdmin({
    email: env.AUTH_SEED_ADMIN_EMAIL,
    password: env.AUTH_SEED_ADMIN_PASSWORD,
    users,
    hasher,
    clock,
    logger: {
      info: (e, ctx) => logger.info(ctx, e),
      warn: (e, ctx) => logger.warn(ctx, e),
    },
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
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res) => (res.statusCode >= 500 ? "error" : "info"),
      redact: {
        paths: [
          "req.headers.authorization",
          'req.headers["x-api-key"]',
          "req.headers.cookie",
          'res.headers["set-cookie"]',
        ],
        remove: false,
      },
    }),
  );
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
      returnResetToken: env.AUTH_RETURN_RESET_TOKEN,
      returnVerificationToken: env.AUTH_RETURN_VERIFICATION_TOKEN,
    },
    adminDeps: { changeRole, unlockUser, jwtVerifier },
    healthDeps: { prisma, rabbitHealthy: () => true },
  });
  app.use(errorMiddlewareExpress);

  const server = app.listen(env.AUTH_PORT, () => {
    logger.info({ port: env.AUTH_PORT }, "request_started_listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutdown_begin");
    server.close();
    await eventBus.close();
    await redis.quit();
    await prisma.$disconnect();
    logger.info({}, "shutdown_complete");
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((err) => {
  // Use direct console because pino may not have initialized
  console.error("FATAL boot failure:", err);
  process.exit(1);
});
