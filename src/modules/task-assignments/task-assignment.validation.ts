import { z } from "zod";
import { ASSIGNMENT_STATUS } from "../../common/constants/status.constant";

export const findAllAssignmentSchema = z.object({
  taskId: z.string().uuid().optional(),
  internId: z.string().uuid().optional(),
  assignedBy: z.string().uuid().optional(),
  leaderId: z.string().uuid().optional(),
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
  sortBy: z.enum(["assignedAt", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
});

export const createAssignmentSchema = z.object({
  taskId: z.string().uuid(),
  internId: z.string().uuid(),
  internEmail: z.string().trim().email("Invalid intern email").max(255).optional(),
});

export const assignTaskSchema = createAssignmentSchema.omit({ taskId: true });

export const updateAssignmentSchema = z
  .object({
    status: z
      .enum([
        ASSIGNMENT_STATUS.TODO,
        ASSIGNMENT_STATUS.IN_PROGRESS,
        ASSIGNMENT_STATUS.REVIEW,
        ASSIGNMENT_STATUS.DONE,
        ASSIGNMENT_STATUS.BLOCKED,
      ])
      .optional(),
    blockedReason: z.string().trim().min(1).max(2000).optional(),
    internId: z.string().uuid().optional(),
    internEmail: z.string().trim().email("Invalid intern email").max(255).optional(),
  })
  .refine((data) => data.status !== undefined || data.internId !== undefined, {
    message:
      "At least one field (status or internId) must be provided for update",
  })
  .refine(
    (data) =>
      data.status !== ASSIGNMENT_STATUS.BLOCKED ||
      data.blockedReason !== undefined,
    {
      message: "blockedReason is required when status is BLOCKED",
      path: ["blockedReason"],
    },
  )
  .refine(
    (data) =>
      data.blockedReason === undefined ||
      data.status === ASSIGNMENT_STATUS.BLOCKED,
    {
      message: "blockedReason can only be provided when status is BLOCKED",
      path: ["blockedReason"],
    },
  );
