import { Router } from "express";
import { TaskAssignmentController } from "./task-assignment.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  findAllAssignmentSchema,
  createAssignmentSchema,
  assignTaskSchema,
  updateAssignmentSchema,
  rejectAssignmentSchema,
  blockTaskSchema,
  assignmentIdParamSchema,
  assignTaskIdParamSchema,
  extensionRequestIdParamSchema,
  requestTaskExtensionSchema,
  rejectTaskExtensionSchema,
  queryExtensionRequestsSchema,
} from "./task-assignment.validation";

const router = Router();
const controller = new TaskAssignmentController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_READ),
  validate(findAllAssignmentSchema, "query"),
  controller.findAll,
);

// ─── Task Extension Routes (Must be before /:id) ─────────────────────────────

router.get(
  "/extension-requests",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_READ),
  validate(queryExtensionRequestsSchema, "query"),
  controller.getExtensionRequests,
);

router.post(
  "/extension-requests/:requestId/approve",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_APPROVE),
  validate(extensionRequestIdParamSchema, "params"),
  controller.approveExtension,
);

router.post(
  "/extension-requests/:requestId/reject",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_APPROVE),
  validate(extensionRequestIdParamSchema, "params"),
  validate(rejectTaskExtensionSchema),
  controller.rejectExtension,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_READ),
  validate(assignmentIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_CREATE),
  validate(createAssignmentSchema),
  controller.create,
);

router.put(
  "/task/:taskId",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_CREATE),
  validate(assignTaskIdParamSchema, "params"),
  validate(assignTaskSchema),
  controller.assignTask,
);

router.delete(
  "/task/:taskId",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_DELETE),
  validate(assignTaskIdParamSchema, "params"),
  controller.unassignTask,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_UPDATE),
  validate(assignmentIdParamSchema, "params"),
  validate(updateAssignmentSchema),
  controller.update,
);

router.patch(
  "/:id/approve",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_APPROVE),
  validate(assignmentIdParamSchema, "params"),
  controller.approve,
);

router.patch(
  "/:id/reject",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_APPROVE),
  validate(assignmentIdParamSchema, "params"),
  validate(rejectAssignmentSchema),
  controller.reject,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_DELETE),
  validate(assignmentIdParamSchema, "params"),
  controller.delete,
);

router.post(
  "/:id/start",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_UPDATE),
  validate(assignmentIdParamSchema, "params"),
  controller.start,
);

router.post(
  "/:id/block",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_UPDATE),
  validate(assignmentIdParamSchema, "params"),
  validate(blockTaskSchema),
  controller.block,
);

router.post(
  "/:id/unblock",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_UPDATE),
  validate(assignmentIdParamSchema, "params"),
  controller.unblock,
);

router.post(
  "/:id/request-extension",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_UPDATE),
  validate(assignmentIdParamSchema, "params"),
  validate(requestTaskExtensionSchema),
  controller.requestExtension,
);

router.get(
  "/:id/extension-requests",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_READ),
  validate(assignmentIdParamSchema, "params"),
  controller.getExtensionRequestsByAssignment,
);

export default router;
