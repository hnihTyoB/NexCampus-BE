import { Router } from "express";
import { NotificationSettingController } from "./notification-setting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { updateNotificationSettingSchema } from "./notification-setting.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new NotificationSettingController();

router.get(
  "/me",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.getMe,
);
router.put(
  "/me",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(updateNotificationSettingSchema),
  controller.updateMe,
);

export default router;
