import { Router } from 'express';
import { systemConfigController } from './system-config.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createSystemConfigSchema,
  updateSystemConfigSchema,
  toggleFeatureFlagSchema,
  configKeyParamSchema,
  querySystemConfigsSchema,
} from './system-config.validation';

const router = Router();

// Public endpoint for clients to fetch public configs/feature flags
router.get('/public', systemConfigController.getPublicConfigs);

// Protected Admin endpoints
router.get(
  '/configs',
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_READ),
  validate(querySystemConfigsSchema, 'query'),
  systemConfigController.findAll,
);

router.get(
  '/configs/:key',
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_READ),
  validate(configKeyParamSchema, 'params'),
  systemConfigController.findByKey,
);

router.post(
  '/configs',
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(createSystemConfigSchema, 'body'),
  systemConfigController.create,
);

router.put(
  '/configs/:key',
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(configKeyParamSchema, 'params'),
  validate(updateSystemConfigSchema, 'body'),
  systemConfigController.update,
);

router.patch(
  '/features/:key/toggle',
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(configKeyParamSchema, 'params'),
  validate(toggleFeatureFlagSchema, 'body'),
  systemConfigController.toggleFeatureFlag,
);

router.delete(
  '/configs/:key',
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(configKeyParamSchema, 'params'),
  systemConfigController.delete,
);

export default router;
