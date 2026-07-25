import { z } from "zod";

export const createTaskGroupSchema = z.object({
  name: z.string().min(1, "Task group name is required").max(100),
  description: z.string().optional(),
});

export const updateTaskGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
});
