import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .or(z.boolean());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    AUTH_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_SERVICE_NAME: z.string().min(1).default("auth-service"),

    AUTH_DB_URL: z.string().url(),
    AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be >= 32 chars"),
    AUTH_SERVICE_JWT_SECRET: z
      .string()
      .min(32, "AUTH_SERVICE_JWT_SECRET must be >= 32 chars"),

    RABBITMQ_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    AUTH_SEED_ADMIN_EMAIL: z.string().email().or(z.literal("")).default(""),
    AUTH_SEED_ADMIN_PASSWORD: z.string().default(""),

    AUTH_RETURN_RESET_TOKEN: booleanString.default(false),
    AUTH_RETURN_VERIFICATION_TOKEN: booleanString.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (env.AUTH_RETURN_RESET_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_RETURN_RESET_TOKEN"],
          message: "AUTH_RETURN_RESET_TOKEN must not be true in production",
        });
      }
      if (env.AUTH_RETURN_VERIFICATION_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_RETURN_VERIFICATION_TOKEN"],
          message:
            "AUTH_RETURN_VERIFICATION_TOKEN must not be true in production",
        });
      }
      if (
        env.AUTH_SEED_ADMIN_PASSWORD !== "" &&
        env.AUTH_SEED_ADMIN_PASSWORD.length < 12
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SEED_ADMIN_PASSWORD"],
          message: "AUTH_SEED_ADMIN_PASSWORD must be >= 12 chars in production",
        });
      }
    } else {
      if (
        env.AUTH_SEED_ADMIN_PASSWORD !== "" &&
        env.AUTH_SEED_ADMIN_PASSWORD.length < 8
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SEED_ADMIN_PASSWORD"],
          message: "AUTH_SEED_ADMIN_PASSWORD must be >= 8 chars",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return parsed.data;
}
