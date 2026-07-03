export const ROLES = {
  ADMIN: 'ADMIN',
  LEADER: 'LEADER',
  INTERN: 'INTERN',
} as const;

export type Role = keyof typeof ROLES;
