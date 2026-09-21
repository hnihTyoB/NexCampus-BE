import { Router } from "express";
import { NotificationSettingController } from "./notification-setting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { updateNotificationSettingSchema } from "./notification-setting.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new NotificationSettingController();

router.use(authMiddleware);

// GET /api/v2/notification-settings
router.get(
  "/",
  requirePermission(PERMISSIONS.NOTIFICATION_SETTING_READ),
  controller.getSettings,
);

// PUT /api/v2/notification-settings
router.put(
  "/",
  requirePermission(PERMISSIONS.NOTIFICATION_SETTING_UPDATE),
  validate(updateNotificationSettingSchema),
  controller.updateSettings,
);

export default router;
