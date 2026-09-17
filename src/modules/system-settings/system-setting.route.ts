import { Router } from "express";
import {
  systemSettingController,
  SystemSettingController,
} from "./system-setting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  settingKeyParamSchema,
  updateSystemSettingSchema,
  batchUpdateSystemSettingsSchema,
} from "./system-setting.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller: SystemSettingController = systemSettingController;

// ── Read Settings (Authenticated users can read operational constraints) ──
router.get("/", authMiddleware, controller.getSettings);

router.get(
  "/:key",
  authMiddleware,
  validate(settingKeyParamSchema, "params"),
  controller.getByKey
);

// ── Modification Endpoints (Yêu cầu quyền SYSTEM_CONFIG_MANAGE) ──
router.put(
  "/:key",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(settingKeyParamSchema, "params"),
  validate(updateSystemSettingSchema, "body"),
  controller.updateSetting
);

router.patch(
  "/:key",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(settingKeyParamSchema, "params"),
  validate(updateSystemSettingSchema, "body"),
  controller.updateSetting
);

router.post(
  "/batch",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(batchUpdateSystemSettingsSchema, "body"),
  controller.batchUpdate
);

export default router;
