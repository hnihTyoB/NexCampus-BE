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

export const TASK_GROUP_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;

export type TaskGroupStatusType = keyof typeof TASK_GROUP_STATUS;

export const ASSIGNMENT_ROLE = {
  OWNER: "OWNER",
  SUPPORT: "SUPPORT",
} as const;

export type AssignmentRoleType = keyof typeof ASSIGNMENT_ROLE;

export const ACTIVE_CAPACITY_STATUSES = [
  ASSIGNMENT_STATUS.PENDING_APPROVAL,
  ASSIGNMENT_STATUS.TODO,
  ASSIGNMENT_STATUS.IN_PROGRESS,
  ASSIGNMENT_STATUS.REVIEW,
] as const;

export const SUPPORT_WORKLOAD_FACTOR = 0.5;
export const DEFAULT_MAX_WORKLOAD_DAYS = 10;
export const DEFAULT_TASK_DAYS = 3;
