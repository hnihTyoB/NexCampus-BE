export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  USER: "USER",
  LEADER: "LEADER",
  INTERN: "INTERN",
} as const;

export type Role = keyof typeof ROLES;
