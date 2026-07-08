import { z } from "zod";

export const findAllTaskSchema = z.object({
  title: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  createdBy: z.string().uuid().optional(),
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
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  deadline: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid deadline",
  }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  deadline: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid deadline" })
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});
