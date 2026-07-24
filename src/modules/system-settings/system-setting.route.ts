import { Router } from "express";
import { SystemSettingController } from "./system-setting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new SystemSettingController();

router.get(
  "/",
  authMiddleware,
  controller.getSettings,
);

router.put(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.updateSetting,
);

export default router;
