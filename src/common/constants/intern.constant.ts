export const INTERN_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

export type InternStatus = (typeof INTERN_STATUS)[keyof typeof INTERN_STATUS];
