import { Router } from "express";
import { TaskController } from "./task.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllTaskSchema,
  createTaskSchema,
  updateTaskSchema,
} from "./task.validation";
import { ROLES } from "../../common/constants/role.constant";
import taskAttachmentRoute from "../task-attachments/task-attachment.route";
import { uploadSingle } from "../../middlewares/upload.middleware";

const router = Router();
const controller = new TaskController();

// ── Analytics (phải đặt TRƯỚC /:id để tránh xung đột route) ─────────────────
router.get(
  "/analytics",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.getAnalytics,
);

// ── Bulk Import ───────────────────────────────────────────────────────────────
/**
 * POST /api/tasks/import/preview
 * Parse file Excel và trả về JSON để UI xem trước trước khi import.
 * Không lưu vào DB.
 */
router.post(
  "/import/preview",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  uploadSingle("file"),
  controller.previewImport,
);

/**
 * POST /api/tasks/import
 * Thực hiện import hàng loạt từ file Excel vào DB (Two-Pass Algorithm).
 */
router.post(
  "/import",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  uploadSingle("file"),
  controller.executeImport,
);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(findAllTaskSchema, "query"),
  controller.findAll,
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findById,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(createTaskSchema),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(updateTaskSchema),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.delete,
);

router.use("/:taskId/attachments", taskAttachmentRoute);

export default router;
