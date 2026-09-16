import { Router } from "express";
import {
  systemSettingController,
  SystemSettingController,
} from "./system-setting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  settingKeyParamSchema,
  updateSystemSettingSchema,
  batchUpdateSystemSettingsSchema,
} from "./system-setting.validation";
import { ROLES } from "../../common/constants/role.constant";

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

// ── Admin-Only Modification Endpoints ──
router.put(
  "/:key",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(settingKeyParamSchema, "params"),
  validate(updateSystemSettingSchema, "body"),
  controller.updateSetting
);

router.patch(
  "/:key",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(settingKeyParamSchema, "params"),
  validate(updateSystemSettingSchema, "body"),
  controller.updateSetting
);

router.post(
  "/batch",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(batchUpdateSystemSettingsSchema, "body"),
  controller.batchUpdate
);

export default router;
