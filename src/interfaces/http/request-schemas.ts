import { z } from "zod";

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["customer", "driver"]),
});
export type RegisterRequestBody = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequestBody = z.infer<typeof LoginRequestSchema>;

export const RefreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenBody = z.infer<typeof RefreshTokenBodySchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequestBody = z.infer<
  typeof PasswordResetRequestSchema
>;

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
export type PasswordResetConfirmBody = z.infer<
  typeof PasswordResetConfirmSchema
>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailBody = z.infer<typeof VerifyEmailSchema>;

export const ChangeRoleSchema = z.object({
  role: z.enum(["customer", "driver", "admin"]),
});
export type ChangeRoleBody = z.infer<typeof ChangeRoleSchema>;

const UUID = z.string().uuid();
export const UserIdParamSchema = z.object({ id: UUID });
