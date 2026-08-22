import { Router } from 'express';
import { RbacController } from './rbac.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
  assignUserRoleSchema,
  roleIdParamSchema,
  rolePermissionParamsSchema,
  roleQuerySchema,
  auditLogQuerySchema,
} from './rbac.validation';
import { userIdParamSchema } from '../users/user.validation';

const router = Router();
const controller = new RbacController();

// Roles endpoints
router.get(
  '/roles',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_READ),
  validate(roleQuerySchema, 'query'),
  controller.findAllRoles
);

router.get(
  '/roles/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_READ),
  validate(roleIdParamSchema, 'params'),
  controller.findRoleById
);

router.post(
  '/roles',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_CREATE),
  validate(createRoleSchema),
  controller.createRole
);

router.put(
  '/roles/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_UPDATE),
  validate(roleIdParamSchema, 'params'),
  validate(updateRoleSchema),
  controller.updateRole
);

router.delete(
  '/roles/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_DELETE),
  validate(roleIdParamSchema, 'params'),
  controller.deleteRole
);

// Permissions endpoints
router.get(
  '/permissions',
  authMiddleware,
  requirePermission(PERMISSIONS.PERMISSION_READ),
  controller.findAllPermissions
);

router.get(
  '/roles/:id/permissions',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_READ),
  validate(roleIdParamSchema, 'params'),
  controller.getRolePermissions
);

router.post(
  '/roles/:id/permissions',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_PERMISSION_ASSIGN),
  validate(roleIdParamSchema, 'params'),
  validate(assignPermissionsSchema),
  controller.syncRolePermissions
);

router.delete(
  '/roles/:id/permissions/:permissionId',
  authMiddleware,
  requirePermission(PERMISSIONS.ROLE_PERMISSION_ASSIGN),
  validate(rolePermissionParamsSchema, 'params'),
  controller.removePermissionFromRole
);

// User role assignment endpoint
router.put(
  '/users/:id/role',
  authMiddleware,
  requirePermission(PERMISSIONS.USER_ROLE_ASSIGN),
  validate(userIdParamSchema, 'params'),
  validate(assignUserRoleSchema),
  controller.assignUserRole
);

// Audit logs endpoint
router.get(
  '/audit-logs',
  authMiddleware,
  requirePermission(PERMISSIONS.AUDIT_LOG_READ),
  validate(auditLogQuerySchema, 'query'),
  controller.findAllAuditLogs
);

export default router;
