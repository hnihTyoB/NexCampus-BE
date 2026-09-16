import { Router } from "express";
import { NotificationSettingController } from "./notification-setting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { updateNotificationSettingSchema } from "./notification-setting.validation";

const router = Router();
const controller = new NotificationSettingController();

router.use(authMiddleware);

// GET /api/v2/notification-settings
router.get("/", controller.getSettings);

// PUT /api/v2/notification-settings
router.put(
  "/",
  validate(updateNotificationSettingSchema),
  controller.updateSettings,
);

export default router;
