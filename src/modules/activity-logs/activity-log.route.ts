import { Router } from "express";
import { ActivityLogController } from "./activity-log.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  activityLogIdParamSchema,
  queryActivityLogSchema,
} from "./activity-log.validation";

const router = Router();
const controller = new ActivityLogController();

router.use(authMiddleware);
router.use(requirePermission(PERMISSIONS.AUDIT_LOG_READ));

// GET /api/v2/activity-logs
router.get(
  "/",
  validate(queryActivityLogSchema, "query"),
  controller.findAll,
);

// GET /api/v2/activity-logs/:id
router.get(
  "/:id",
  validate(activityLogIdParamSchema, "params"),
  controller.findById,
);

export default router;
