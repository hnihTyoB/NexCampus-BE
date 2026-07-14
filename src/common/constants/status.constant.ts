export const APPLICATION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ApplicationStatusType = keyof typeof APPLICATION_STATUS;

export const INTERN_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

export type InternStatusType = keyof typeof INTERN_STATUS;

export const TASK_PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

export type TaskPriorityType = keyof typeof TASK_PRIORITY;

export const ASSIGNMENT_STATUS = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW: "REVIEW",
  DONE: "DONE",
  BLOCKED: "BLOCKED",
} as const;

export type AssignmentStatusType = keyof typeof ASSIGNMENT_STATUS;

export const REVIEW_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ReviewStatusType = keyof typeof REVIEW_STATUS;

export const NOTIFICATION_CHANNEL = {
  WEB: "WEB",
  EMAIL: "EMAIL",
  DISCORD: "DISCORD",
} as const;

export type NotificationChannelType = keyof typeof NOTIFICATION_CHANNEL;

export const NOTIFICATION_LOG_STATUS = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type NotificationLogStatusType = keyof typeof NOTIFICATION_LOG_STATUS;

export const NOTIFICATION_TYPE = {
  TASK_ASSIGNMENT: "TASK_ASSIGNMENT",
  TASK_SUBMISSION: "TASK_SUBMISSION",
  SUBMISSION_REVIEW: "SUBMISSION_REVIEW",
  DAILY_REPORT: "DAILY_REPORT",
  WEEKLY_EVALUATION: "WEEKLY_EVALUATION",
  TASK_REMINDER: "TASK_REMINDER",
  EVALUATION_REMINDER: "EVALUATION_REMINDER",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE;

