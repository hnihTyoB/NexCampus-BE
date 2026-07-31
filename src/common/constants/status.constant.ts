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
  PENDING_APPROVAL: "PENDING_APPROVAL",
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
  TASK_ASSIGNMENT_REJECTED: "TASK_ASSIGNMENT_REJECTED",
  EVALUATION_REMINDER: "EVALUATION_REMINDER",
  APPLICATION_INVITE: "APPLICATION_INVITE",
  APPLICATION_APPROVED: "APPLICATION_APPROVED",
  APPLICATION_REJECTED: "APPLICATION_REJECTED",
  USER_CREATED: "USER_CREATED",
  PASSWORD_RESET: "PASSWORD_RESET",
  SECURITY_ALERT: "SECURITY_ALERT",
  MEETING_INVITATION: "MEETING_INVITATION",
  MEETING_CREATED: "MEETING_CREATED",
  MEETING_CANCELLED: "MEETING_CANCELLED",
  ABSENCE_SUBMITTED: "ABSENCE_SUBMITTED",
  ABSENCE_REVIEWED: "ABSENCE_REVIEWED",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE;

export const APPLICATION_INVITE_STATUS = {
  ACTIVE: "ACTIVE",
  USED: "USED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;

export type ApplicationInviteStatusType = keyof typeof APPLICATION_INVITE_STATUS;

export const MEETING_TYPE = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  HYBRID: "HYBRID",
} as const;
export type MeetingTypeType = keyof typeof MEETING_TYPE;

export const MEETING_STATUS = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type MeetingStatusType = keyof typeof MEETING_STATUS;

export const MEETING_VISIBILITY = {
  PRIVATE: "PRIVATE",
  TEAM: "TEAM",
} as const;
export type MeetingVisibilityType = keyof typeof MEETING_VISIBILITY;

export const PARTICIPANT_ROLE = {
  HOST: "HOST",
  ORGANIZER: "ORGANIZER",
  PARTICIPANT: "PARTICIPANT",
} as const;
export type ParticipantRoleType = keyof typeof PARTICIPANT_ROLE;

export const INVITATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
} as const;
export type InvitationStatusType = keyof typeof INVITATION_STATUS;

export const ATTENDANCE_STATUS = {
  UNKNOWN: "UNKNOWN",
  ATTENDED: "ATTENDED",
  ABSENT: "ABSENT",
} as const;
export type AttendanceStatusType = keyof typeof ATTENDANCE_STATUS;

export const ABSENCE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type AbsenceStatusType = keyof typeof ABSENCE_STATUS;


