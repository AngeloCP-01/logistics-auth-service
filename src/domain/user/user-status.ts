export const USER_STATUS_VALUES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUS_VALUES)[number];
