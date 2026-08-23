import { RbacRepository } from './rbac.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { CreateRoleDto, UpdateRoleDto, RoleQueryDto, AuditLogQueryDto } from './rbac.dto';
import { permissionCacheService } from '../../common/services/permission-cache.service';
import { ROLES } from '../../common/constants/role.constant';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import { NOTIFICATION_TYPE, NOTIFICATION_PRIORITY } from '../../common/constants/notification.constant';
import { notificationDispatcher } from '../../common/services/notification-dispatcher.service';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class RbacService {
  private readonly repository = new RbacRepository();

  async findAllRoles(query: RoleQueryDto) {
    return this.repository.findAllRoles(query);
  }

  async findRoleById(id: string) {
    const role = await this.repository.findRoleById(id);
    if (!role) {
      throw new AppError('Role not found', 404, ERROR_CODE.NOT_FOUND);
    }
    return role;
  }

  async createRole(
    data: CreateRoleDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const existing = await this.repository.findRoleByName(data.name);
    if (existing) {
      throw new AppError(`Role with name '${data.name}' already exists`, 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    if (data.permissionIds && data.permissionIds.length > 0) {
      const validPermissions = await this.repository.findPermissionsByIds(data.permissionIds);
      if (validPermissions.length !== data.permissionIds.length) {
        throw new AppError('One or more permission IDs are invalid', 400, ERROR_CODE.VALIDATION_ERROR);
      }
    }

    const role = await this.repository.createRole(data);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.CREATE_ROLE,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: role.id,
      details: { name: role.name, description: role.description, permissionsCount: data.permissionIds?.length || 0 },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.findRoleById(role.id);
  }

  async updateRole(
    id: string,
    data: UpdateRoleDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const role = await this.findRoleById(id);

    if (data.name && data.name !== role.name) {
      if (role.isSystem) {
        throw new AppError('Cannot rename system roles (ADMIN, MANAGER, USER)', 400, ERROR_CODE.VALIDATION_ERROR);
      }

      const existing = await this.repository.findRoleByName(data.name);
      if (existing && existing.id !== id) {
        throw new AppError(`Role with name '${data.name}' already exists`, 409, ERROR_CODE.DUPLICATE_ENTRY);
      }
    }

    const updated = await this.repository.updateRole(id, data);
    permissionCacheService.invalidateRole(id);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.UPDATE_ROLE,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: id,
      details: { previous: { name: role.name, description: role.description }, updated: data },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.findRoleById(updated.id);
  }

  async deleteRole(
    id: string,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const role = await this.findRoleById(id);

    if (role.isSystem) {
      throw new AppError('Cannot delete system roles (ADMIN, MANAGER, USER)', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    if (role.userCount > 0) {
      throw new AppError(
        `Cannot delete role '${role.name}' because it currently has ${role.userCount} assigned users. Reassign users first.`,
        400,
        ERROR_CODE.VALIDATION_ERROR
      );
    }

    await this.repository.deleteRole(id);
    permissionCacheService.invalidateRole(id);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.DELETE_ROLE,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: id,
      details: { name: role.name },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }

  async findAllPermissions() {
    return this.repository.findAllPermissions();
  }

  async syncRolePermissions(
    roleId: string,
    permissionIds: string[],
    context?: { actorId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const role = await this.findRoleById(roleId);

    const validPermissions = await this.repository.findPermissionsByIds(permissionIds);
    if (validPermissions.length !== permissionIds.length) {
      throw new AppError('One or more permission IDs are invalid', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    // Anti-lockout protection: ADMIN role must retain ROLE_PERMISSION_ASSIGN
    if (role.name === ROLES.ADMIN) {
      const assignPerm = await this.repository.findPermissionByName(PERMISSIONS.ROLE_PERMISSION_ASSIGN);
      if (assignPerm && !permissionIds.includes(assignPerm.id)) {
        throw new AppError(
          'Security Violation: Cannot revoke ROLE_PERMISSION_ASSIGN permission from the ADMIN role.',
          400,
          ERROR_CODE.VALIDATION_ERROR
        );
      }
    }

    await this.repository.syncRolePermissions(roleId, permissionIds);
    permissionCacheService.invalidateRole(roleId);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.SYNC_ROLE_PERMISSIONS,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: roleId,
      details: {
        roleName: role.name,
        previousCount: role.permissions.length,
        newCount: permissionIds.length,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.findRoleById(roleId);
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const role = await this.findRoleById(roleId);

    // Anti-lockout protection: ADMIN role must retain ROLE_PERMISSION_ASSIGN
    if (role.name === ROLES.ADMIN) {
      const assignPerm = await this.repository.findPermissionByName(PERMISSIONS.ROLE_PERMISSION_ASSIGN);
      if (assignPerm && assignPerm.id === permissionId) {
        throw new AppError(
          'Security Violation: Cannot revoke ROLE_PERMISSION_ASSIGN permission from the ADMIN role.',
          400,
          ERROR_CODE.VALIDATION_ERROR
        );
      }
    }

    await this.repository.removePermissionFromRole(roleId, permissionId);
    permissionCacheService.invalidateRole(roleId);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.REMOVE_ROLE_PERMISSION,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: roleId,
      details: { roleName: role.name, permissionId },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.findRoleById(roleId);
  }

  async assignUserRole(
    userId: string,
    newRoleId: string,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const targetRole = await this.findRoleById(newRoleId);
    const currentUser = await this.repository.findUserById(userId);
    if (!currentUser) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }
    const oldRoleId = currentUser.roleId;

    const user = await this.repository.assignUserRole(userId, targetRole.id);
    if (oldRoleId && oldRoleId !== targetRole.id) {
      permissionCacheService.invalidateRole(oldRoleId);
    }
    permissionCacheService.invalidateRole(user.roleId);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.ASSIGN_USER_ROLE,
      targetType: AUDIT_TARGET_TYPE.USER,
      targetId: userId,
      details: { userEmail: user.email, assignedRole: targetRole.name },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    // Thông báo cho user biết vai trò của họ vừa được cập nhật
    notificationDispatcher.notify(
      userId,
      NOTIFICATION_TYPE.INFO,
      'Cập nhật vai trò tài khoản',
      `Vai trò tài khoản của bạn đã được cập nhật thành: ${targetRole.name}.`,
      { priority: NOTIFICATION_PRIORITY.HIGH }
    ).catch(err => console.error('Failed to notify role assignment:', err));

    return user;
  }

  async findAllAuditLogs(query: AuditLogQueryDto) {
    return this.repository.findAllAuditLogs(query);
  }
}
