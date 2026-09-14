import { z } from "zod";
import { TASK_GROUP_STATUS } from "../../common/constants/task.constant";

export const taskGroupIdParamSchema = z.object({
  id: z.string().uuid("Invalid task group ID"),
});

export const createTaskGroupSchema = z.object({
  name: z.string().trim().min(1, "Task group name is required").max(100),
  description: z.string().trim().max(1000).optional(),
  departmentId: z.string().uuid("Invalid departmentId").optional().nullable(),
  status: z
    .enum([
      TASK_GROUP_STATUS.ACTIVE,
      TASK_GROUP_STATUS.COMPLETED,
      TASK_GROUP_STATUS.ARCHIVED,
    ])
    .optional()
    .default(TASK_GROUP_STATUS.ACTIVE),
  memberIds: z.array(z.string().uuid("Invalid internId")).max(100).optional(),
  maxWorkloadDays: z.number().positive().max(365).optional().default(10),
  maxActiveTasks: z.number().int().positive().max(100).optional().nullable(),
  requireAllMembers: z.boolean().optional().default(false),
});

export const updateTaskGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  departmentId: z.string().uuid("Invalid departmentId").optional().nullable(),
  status: z
    .enum([
      TASK_GROUP_STATUS.ACTIVE,
      TASK_GROUP_STATUS.COMPLETED,
      TASK_GROUP_STATUS.ARCHIVED,
    ])
    .optional(),
  memberIds: z.array(z.string().uuid("Invalid internId")).max(100).optional(),
  maxWorkloadDays: z.number().positive().max(365).optional(),
  maxActiveTasks: z.number().int().positive().max(100).optional().nullable(),
  requireAllMembers: z.boolean().optional(),
});

export const queryTaskGroupSchema = z.object({
  departmentId: z.string().uuid("Invalid departmentId").optional(),
  status: z
    .enum([
      TASK_GROUP_STATUS.ACTIVE,
      TASK_GROUP_STATUS.COMPLETED,
      TASK_GROUP_STATUS.ARCHIVED,
    ])
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
