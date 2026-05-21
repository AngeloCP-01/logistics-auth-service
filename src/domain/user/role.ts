export const ROLE_VALUES = ["customer", "driver", "admin"] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const PUBLIC_REGISTRATION_ROLES = ["customer", "driver"] as const;
export type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (ROLE_VALUES as readonly string[]).includes(value)
  );
}

export function isPublicRegistrationRole(
  value: unknown,
): value is PublicRegistrationRole {
  return (
    typeof value === "string" &&
    (PUBLIC_REGISTRATION_ROLES as readonly string[]).includes(value)
  );
}
