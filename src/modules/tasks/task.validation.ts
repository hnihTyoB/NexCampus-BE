import { z } from "zod";

export const findAllTaskSchema = z.object({
  title: z.string().optional(),
  code: z.string().optional(),
  owner: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  createdBy: z.string().uuid().optional(),
  phase: z.string().optional(),
  module: z.string().optional(),
  taskGroupId: z.string().uuid().optional(),
  status: z
    .enum(["PENDING_APPROVAL", "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"])
    .optional(),
  statusNot: z
    .enum(["PENDING_APPROVAL", "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"])
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

export const taskAnalyticsQuerySchema = z.object({
  taskGroupId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid dateFrom" })
    .optional(),
  dateTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid dateTo" })
    .optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  deadline: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid deadline",
  }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  // Extended fields
  code: z.string().max(50).optional(),
  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startDate" })
    .optional(),
  estDays: z.number().positive().max(365),
  phase: z.string().max(100).optional(),
  module: z.string().max(100).optional(),
  acceptanceCriteria: z.string().optional(),
  taskNotes: z.string().optional(),
  taskGroupId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  deadline: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid deadline" })
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  // Extended fields
  code: z.string().max(50).nullable().optional(),
  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startDate" })
    .nullable()
    .optional(),
  estDays: z.number().positive().max(365).nullable().optional(),
  phase: z.string().max(100).nullable().optional(),
  module: z.string().max(100).nullable().optional(),
  acceptanceCriteria: z.string().nullable().optional(),
  taskNotes: z.string().nullable().optional(),
  taskGroupId: z.string().uuid().nullable().optional(),
  recreatedTaskId: z.string().uuid().nullable().optional(),
});
