import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  listNotificationTemplatesSchema,
  templateCodeParamSchema,
  templateIdParamSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  previewNotificationTemplateSchema,
  testSendNotificationTemplateSchema,
} from "./notification.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);

// ── Notification Templates Management Endpoints (/notification-templates) ──

router.get(
  "/",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ),
  validate(listNotificationTemplatesSchema, "query"),
  controller.listTemplates,
);

router.post(
  "/",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(createNotificationTemplateSchema),
  controller.createTemplate,
);

router.get(
  "/:code",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ),
  validate(templateCodeParamSchema, "params"),
  controller.getTemplateByCode,
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(templateIdParamSchema, "params"),
  validate(updateNotificationTemplateSchema),
  controller.updateTemplate,
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(templateIdParamSchema, "params"),
  controller.deleteTemplate,
);

router.post(
  "/:code/preview",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ),
  validate(templateCodeParamSchema, "params"),
  validate(previewNotificationTemplateSchema),
  controller.previewTemplate,
);

router.post(
  "/:code/test-send",
  requirePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate(templateCodeParamSchema, "params"),
  validate(testSendNotificationTemplateSchema),
  controller.testSendTemplate,
);

export default router;
