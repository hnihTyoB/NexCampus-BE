import { Router } from "express";
import { NotificationTemplateController } from "./notification-template.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  upsertByTypeSchema,
} from "./notification-template.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new NotificationTemplateController();

// List & single
router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.findAll,
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.findById,
);

// Create
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createNotificationTemplateSchema),
  controller.create,
);

// Upsert by type — must be registered BEFORE /:id to avoid route conflict
router.put(
  "/type/:type",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(upsertByTypeSchema),
  controller.upsertByType,
);

// Update by id
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateNotificationTemplateSchema),
  controller.update,
);

// Reset to defaults
router.post(
  "/:id/reset",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.reset,
);

export default router;
