import { loadEnv } from "@/config/env.js";

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  AUTH_DB_URL: "postgresql://u:p@localhost:5432/auth",
  AUTH_JWT_SECRET: "x".repeat(32),
  AUTH_SERVICE_JWT_SECRET: "y".repeat(32),
  RABBITMQ_URL: "amqp://dev:dev@localhost:5672",
  REDIS_URL: "redis://localhost:6379",
};

describe("loadEnv", () => {
  it("parses a minimal valid environment", () => {
    const env = loadEnv(baseEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.AUTH_PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.AUTH_RETURN_RESET_TOKEN).toBe(false);
  });

  it("coerces AUTH_PORT from string", () => {
    const env = loadEnv({ ...baseEnv, AUTH_PORT: "8080" });
    expect(env.AUTH_PORT).toBe(8080);
  });

  it("rejects an AUTH_JWT_SECRET shorter than 32 chars", () => {
    expect(() => loadEnv({ ...baseEnv, AUTH_JWT_SECRET: "tooshort" })).toThrow(
      /AUTH_JWT_SECRET/,
    );
  });

  it("rejects an invalid AUTH_DB_URL", () => {
    expect(() => loadEnv({ ...baseEnv, AUTH_DB_URL: "not-a-url" })).toThrow(
      /AUTH_DB_URL/,
    );
  });

  it("refuses AUTH_RETURN_RESET_TOKEN=true in production", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: "production",
        AUTH_RETURN_RESET_TOKEN: "true",
      }),
    ).toThrow(/AUTH_RETURN_RESET_TOKEN.*production/);
  });

  it("refuses AUTH_RETURN_VERIFICATION_TOKEN=true in production", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: "production",
        AUTH_RETURN_VERIFICATION_TOKEN: "true",
      }),
    ).toThrow(/AUTH_RETURN_VERIFICATION_TOKEN.*production/);
  });

  it("requires a 12-char admin password in production", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: "production",
        AUTH_SEED_ADMIN_EMAIL: "admin@example.com",
        AUTH_SEED_ADMIN_PASSWORD: "short11char",
      }),
    ).toThrow(/AUTH_SEED_ADMIN_PASSWORD.*production/);
  });

  it("accepts a missing admin password (no seed)", () => {
    const env = loadEnv({
      ...baseEnv,
      NODE_ENV: "production",
      AUTH_RETURN_RESET_TOKEN: "false",
      AUTH_RETURN_VERIFICATION_TOKEN: "false",
    });
    expect(env.AUTH_SEED_ADMIN_PASSWORD).toBe("");
  });

  it("aggregates multiple errors into one message", () => {
    expect(() => loadEnv({})).toThrow(/AUTH_DB_URL/);
  });
});
