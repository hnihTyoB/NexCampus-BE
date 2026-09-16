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

export const ALLOWED_APPLICATION_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedApplicationMimeType =
  (typeof ALLOWED_APPLICATION_MIME_TYPES)[number];

