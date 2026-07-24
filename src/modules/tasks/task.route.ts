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

router.get(
  "/analytics",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.getAnalytics,
);

router.post(
  "/import/preview",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  uploadSingle("file"),
  controller.previewImport,
);

router.post(
  "/import",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  uploadSingle("file"),
  controller.executeImport,
);

router.get(
  "/import/template",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.downloadTemplate,
);

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

router.post(
  "/:taskId/ai-recommendation",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.getAiRecommendation,
);

router.use("/:taskId/attachments", taskAttachmentRoute);

export default router;
