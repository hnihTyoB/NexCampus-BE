import { Router } from "express";
import { cronController } from "./cron.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  cronJobNameParamSchema,
  triggerCronJobSchema,
  listCronJobsQuerySchema,
  toggleCronJobSchema,
} from "./cron.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();

router.use(authMiddleware);

router.get(
  "/jobs",
  requirePermission(PERMISSIONS.CRON_JOB_READ),
  validate(listCronJobsQuerySchema, "query"),
  cronController.listJobs,
);

router.post(
  "/jobs/:jobName/trigger",
  requirePermission(PERMISSIONS.CRON_JOB_MANAGE),
  validate(cronJobNameParamSchema, "params"),
  validate(triggerCronJobSchema),
  cronController.triggerJob,
);

router.patch(
  "/jobs/:jobName/toggle",
  requirePermission(PERMISSIONS.CRON_JOB_MANAGE),
  validate(cronJobNameParamSchema, "params"),
  validate(toggleCronJobSchema, "body"),
  cronController.toggleJob,
);

export default router;

