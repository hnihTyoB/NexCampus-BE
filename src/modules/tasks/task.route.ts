import { Router } from "express";
import { TaskController } from "./task.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  findAllTaskSchema,
  taskAnalyticsQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  taskAttachmentParamsSchema,
  getAttachmentUploadUrlSchema,
  confirmAttachmentUploadSchema,
  createLinkAttachmentSchema,
  aiSuggestTaskAllocationSchema,
} from "./task.validation";

const router = Router();
const controller = new TaskController();

// ─── Task CRUD ──────────────────────────────────────────────────────────────

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_READ),
  validate(findAllTaskSchema, "query"),
  controller.findAll,
);

router.get(
  "/analytics",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_READ),
  validate(taskAnalyticsQuerySchema, "query"),
  controller.getAnalytics,
);

router.post(
  "/ai-suggest-allocation",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_CREATE),
  validate(aiSuggestTaskAllocationSchema),
  controller.suggestAllocation,
);

router.post(
  "/:id/ai-recommendation",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_CREATE),
  validate(taskIdParamSchema, "params"),
  controller.getAiRecommendation,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_READ),
  validate(taskIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_CREATE),
  validate(createTaskSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_UPDATE),
  validate(taskIdParamSchema, "params"),
  validate(updateTaskSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_DELETE),
  validate(taskIdParamSchema, "params"),
  controller.delete,
);

// ─── Attachments Sub-Routes ─────────────────────────────────────────────────

router.get(
  "/:taskId/attachments",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_READ),
  validate(taskAttachmentParamsSchema, "params"),
  controller.findAttachments,
);

router.get(
  "/:taskId/attachments/upload-url",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ATTACHMENT_UPLOAD),
  validate(taskAttachmentParamsSchema, "params"),
  validate(getAttachmentUploadUrlSchema, "query"),
  controller.getAttachmentUploadUrl,
);

router.post(
  "/:taskId/attachments/confirm",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ATTACHMENT_UPLOAD),
  validate(taskAttachmentParamsSchema, "params"),
  validate(confirmAttachmentUploadSchema),
  controller.confirmAttachment,
);

router.post(
  "/:taskId/attachments/link",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ATTACHMENT_UPLOAD),
  validate(taskAttachmentParamsSchema, "params"),
  validate(createLinkAttachmentSchema),
  controller.createLinkAttachment,
);

router.delete(
  "/:taskId/attachments/:attachmentId",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ATTACHMENT_DELETE),
  validate(taskAttachmentParamsSchema, "params"),
  controller.deleteAttachment,
);

export default router;
