import { z } from "zod";
import { TASK_PRIORITY, ASSIGNMENT_STATUS } from "../../common/constants/task.constant";

const prioritySchema = z
  .union([
    z.enum([TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH]),
    z.enum(["P0", "P1", "P2"]),
  ])
  .transform((val) => {
    if (val === "P0") return TASK_PRIORITY.HIGH;
    if (val === "P1") return TASK_PRIORITY.MEDIUM;
    if (val === "P2") return TASK_PRIORITY.LOW;
    return val;
  });

export const taskIdParamSchema = z.object({
  id: z.string().uuid("Invalid task ID"),
});

export const taskAttachmentParamsSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  attachmentId: z.string().uuid("Invalid attachment ID").optional(),
});

export const findAllTaskSchema = z.object({
  title: z.string().trim().optional(),
  code: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  priority: prioritySchema.optional(),
  createdBy: z.string().uuid().optional(),
  phase: z.string().trim().optional(),
  module: z.string().trim().optional(),
  taskGroupId: z.string().uuid().optional(),
  status: z
    .enum([
      ASSIGNMENT_STATUS.PENDING_APPROVAL,
      ASSIGNMENT_STATUS.TODO,
      ASSIGNMENT_STATUS.IN_PROGRESS,
      ASSIGNMENT_STATUS.REVIEW,
      ASSIGNMENT_STATUS.DONE,
      ASSIGNMENT_STATUS.BLOCKED,
    ])
    .optional(),
  statusNot: z
    .enum([
      ASSIGNMENT_STATUS.PENDING_APPROVAL,
      ASSIGNMENT_STATUS.TODO,
      ASSIGNMENT_STATUS.IN_PROGRESS,
      ASSIGNMENT_STATUS.REVIEW,
      ASSIGNMENT_STATUS.DONE,
      ASSIGNMENT_STATUS.BLOCKED,
    ])
    .optional(),
  deadlineFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid deadlineFrom" })
    .optional(),
  deadlineTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid deadlineTo" })
    .optional(),
  sortBy: z.enum(["createdAt", "title", "deadline", "priority"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().optional(),
  deadline: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid deadline",
  }),
  priority: prioritySchema.optional().default(TASK_PRIORITY.MEDIUM),
  code: z.string().trim().max(50).optional(),
  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startDate" })
    .optional(),
  estDays: z.coerce.number().positive().max(365),
  phase: z.string().trim().max(100).optional(),
  module: z.string().trim().max(100).optional(),
  acceptanceCriteria: z.string().trim().optional(),
  taskNotes: z.string().trim().optional(),
  taskGroupId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().nullable().optional(),
  deadline: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid deadline" })
    .optional(),
  priority: prioritySchema.optional(),
  code: z.string().trim().max(50).nullable().optional(),
  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startDate" })
    .nullable()
    .optional(),
  estDays: z.coerce.number().positive().max(365).nullable().optional(),
  phase: z.string().trim().max(100).nullable().optional(),
  module: z.string().trim().max(100).nullable().optional(),
  acceptanceCriteria: z.string().trim().nullable().optional(),
  taskNotes: z.string().trim().nullable().optional(),
  taskGroupId: z.string().uuid().nullable().optional(),
  recreatedTaskId: z.string().uuid().nullable().optional(),
});

export const getAttachmentUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "fileName is required"),
  contentType: z.string().trim().min(1, "contentType is required"),
  fileSize: z.coerce.number().int().positive().optional(),
});

export const confirmAttachmentUploadSchema = z.object({
  filePath: z.string().trim().min(1, "filePath is required"),
  fileName: z.string().trim().min(1, "fileName is required"),
  mimeType: z.string().trim().min(1, "mimeType is required"),
  fileSize: z.coerce.number().int().positive(),
});

export const createLinkAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, "fileName is required").max(255),
  fileUrl: z.string().trim().url("Invalid URL"),
});
