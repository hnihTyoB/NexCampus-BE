import { Router } from 'express';
import { maintenanceController } from './maintenance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { enableMaintenanceSchema, updateMaintenanceSchema } from './maintenance.validation';
import { PERMISSIONS } from '../../common/constants/permission.constant';

const router = Router();

// Public endpoint for clients to check maintenance status
router.get('/public', maintenanceController.getPublicStatus);

// Protected endpoints for administrators
router.get(
  '/status',
  authMiddleware,
  requireAnyPermission(PERMISSIONS.MAINTENANCE_READ, PERMISSIONS.MAINTENANCE_MANAGE),
  maintenanceController.getStatus,
);

router.post(
  '/enable',
  authMiddleware,
  requirePermission(PERMISSIONS.MAINTENANCE_MANAGE),
  validate(enableMaintenanceSchema, 'body'),
  maintenanceController.enable,
);

router.put(
  '/config',
  authMiddleware,
  requirePermission(PERMISSIONS.MAINTENANCE_MANAGE),
  validate(updateMaintenanceSchema, 'body'),
  maintenanceController.updateConfig,
);

router.post(
  '/disable',
  authMiddleware,
  requirePermission(PERMISSIONS.MAINTENANCE_MANAGE),
  maintenanceController.disable,
);

export default router;
