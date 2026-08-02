import { z } from "zod";

export const createTaskGroupSchema = z.object({
  name: z.string().min(1, "Task group name is required").max(100),
  description: z.string().optional(),
  departmentId: z.string().uuid("Invalid departmentId").optional().nullable(),
  memberIds: z.array(z.string().uuid("Invalid internId")).max(100).optional(),
  maxWorkloadDays: z.number().positive().max(365).optional(),
  maxActiveTasks: z.number().int().positive().max(100).optional().nullable(),
  requireAllMembers: z.boolean().optional(),
});

export const updateTaskGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  departmentId: z.string().uuid("Invalid departmentId").optional().nullable(),
  memberIds: z.array(z.string().uuid("Invalid internId")).max(100).optional(),
  maxWorkloadDays: z.number().positive().max(365).optional(),
  maxActiveTasks: z.number().int().positive().max(100).optional().nullable(),
  requireAllMembers: z.boolean().optional(),
});

export const confirmGroupAllocationSchema = z.object({
  assignments: z
    .array(
      z
        .object({
          taskId: z.string().uuid(),
          internId: z.string().uuid(),
          supportId: z.string().uuid().nullable().optional(),
        })
        .refine(
          (item) => !item.supportId || item.supportId !== item.internId,
          { message: "Owner and Support must be different interns" },
        ),
    )
    .min(1, "Danh sách phân công rỗng")
    .max(1000),
});
