export const APPLICATION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const APPLICATION_INVITE_STATUS = {
  UNUSED: "UNUSED",
  ACTIVE: "ACTIVE",
  USED: "USED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;

export type ApplicationInviteStatus =
  (typeof APPLICATION_INVITE_STATUS)[keyof typeof APPLICATION_INVITE_STATUS];
