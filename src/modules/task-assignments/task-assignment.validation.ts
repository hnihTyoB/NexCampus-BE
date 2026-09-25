import { z } from "zod";
import { ASSIGNMENT_STATUS } from "../../common/constants/task.constant";

export const assignmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid assignment ID"),
});

export const assignTaskIdParamSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
});

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
      ASSIGNMENT_STATUS.EXTENSION_PENDING,
    ])
    .optional(),
  sortBy: z.enum(["assignedAt", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
});

export const createAssignmentSchema = z
  .object({
    taskId: z.string().uuid("Invalid taskId"),
    internId: z.string().uuid("Invalid internId"),
    internEmail: z.string().trim().email("Invalid intern email").max(255).optional(),
    supportId: z.string().uuid("Invalid supportId").nullable().optional(),
  })
  .refine(
    (data) => !data.supportId || data.supportId !== data.internId,
    {
      message: "Owner and Support must be different interns",
      path: ["supportId"],
    },
  );

export const assignTaskSchema = z
  .object({
    internId: z.string().uuid("Invalid internId"),
    internEmail: z.string().trim().email("Invalid intern email").max(255).optional(),
    supportId: z.string().uuid("Invalid supportId").nullable().optional(),
  })
  .refine(
    (data) => !data.supportId || data.supportId !== data.internId,
    {
      message: "Owner and Support must be different interns",
      path: ["supportId"],
    },
  );

export const updateAssignmentSchema = z
  .object({
    status: z
      .enum([
        ASSIGNMENT_STATUS.TODO,
        ASSIGNMENT_STATUS.IN_PROGRESS,
        ASSIGNMENT_STATUS.REVIEW,
        ASSIGNMENT_STATUS.DONE,
        ASSIGNMENT_STATUS.BLOCKED,
        ASSIGNMENT_STATUS.EXTENSION_PENDING,
      ])
      .optional(),
    blockedReason: z.string().trim().min(1).max(2000).optional(),
    internId: z.string().uuid().optional(),
    internEmail: z.string().trim().email("Invalid intern email").max(255).optional(),
    supportId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.internId !== undefined ||
      data.supportId !== undefined,
    {
      message: "At least one field (status, internId, or supportId) must be provided for update",
    },
  )
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
  )
  .refine(
    (data) =>
      !data.supportId ||
      !data.internId ||
      data.supportId !== data.internId,
    {
      message: "Owner and Support must be different interns",
      path: ["supportId"],
    },
  );

export const rejectAssignmentSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const blockTaskSchema = z.object({
  blockedReason: z.string().trim().min(1, "blockedReason is required").max(2000),
});

export const extensionRequestIdParamSchema = z.object({
  requestId: z.string().uuid("Invalid extension request ID"),
});

export const requestTaskExtensionSchema = z.object({
  proposedDeadline: z.string().trim().min(1, "proposedDeadline is required"),
  extensionDays: z.coerce.number().int().min(1, "Số ngày gia hạn tối thiểu là 1").max(90, "Số ngày gia hạn không được vượt quá 90 ngày"),
  reason: z.string().trim().min(5, "Lý do xin gia hạn tối thiểu 5 ký tự").max(2000, "Lý do không được vượt quá 2000 ký tự"),
  commitmentPlan: z.string().trim().min(5, "Kế hoạch cam kết tối thiểu 5 ký tự").max(2000, "Kế hoạch cam kết không được vượt quá 2000 ký tự"),
});

export const rejectTaskExtensionSchema = z.object({
  rejectionReason: z.string().trim().min(1, "Lý do từ chối là bắt buộc").max(2000, "Lý do không được vượt quá 2000 ký tự"),
});

export const queryExtensionRequestsSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  internId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
});

