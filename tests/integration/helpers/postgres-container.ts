import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export interface TestPostgres {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
  url: string;
}

export async function startPostgresWithMigrations(): Promise<TestPostgres> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("auth")
    .withUsername("auth")
    .withPassword("auth")
    .start();
  const url = `postgresql://auth:auth@${container.getHost()}:${container.getMappedPort(5432)}/auth?schema=public`;

  // Apply Prisma migrations
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, AUTH_DB_URL: url },
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return { container, prisma, url };
}

export async function stopPostgres(p: TestPostgres): Promise<void> {
  await p.prisma.$disconnect();
  await p.container.stop();
}

export async function resetTables(prisma: PrismaClient): Promise<void> {
  // Order matters due to FK constraints (children first)
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();
}
