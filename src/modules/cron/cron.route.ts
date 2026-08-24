import { Router } from 'express';
import { cronController } from './cron.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cronJobNameParamSchema, triggerCronJobSchema, listCronJobsQuerySchema } from './cron.validation';
import { PERMISSIONS } from '../../common/constants/permission.constant';

const router = Router();

router.use(authMiddleware);

router.get(
  '/jobs',
  requirePermission(PERMISSIONS.CRON_JOB_READ),
  validate(listCronJobsQuerySchema, 'query'),
  cronController.listJobs,
);

router.post(
  '/jobs/:jobName/trigger',
  requirePermission(PERMISSIONS.CRON_JOB_MANAGE),
  validate(cronJobNameParamSchema, 'params'),
  validate(triggerCronJobSchema),
  cronController.triggerJob,
);

export default router;
