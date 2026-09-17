import { RbacRepository } from "./rbac.repository";
import { userRepository } from "../users/user.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleQueryDto,
  AuditLogQueryDto,
} from "./rbac.dto";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { ROLES } from "../../common/constants/role.constant";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
} from "../../common/constants/notification.constant";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";

export class RbacService {
  private readonly repository = new RbacRepository();

  async findAllRoles(query: RoleQueryDto) {
    return this.repository.findAllRoles(query);
  }

  async findRoleById(id: string) {
    const role = await this.repository.findRoleById(id);
    if (!role) {
      throw new AppError("Role not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return role;
  }

  async createRole(
    data: CreateRoleDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findRoleByName(data.name);
    if (existing) {
      throw new AppError(
        `Role with name '${data.name}' already exists`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    if (data.permissionIds && data.permissionIds.length > 0) {
      const validPermissions = await this.repository.findPermissionsByIds(
        data.permissionIds,
      );
      if (validPermissions.length !== data.permissionIds.length) {
        throw new AppError(
          "One or more permission IDs are invalid",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      // SEC-P0: Ngăn chặn leo thang đặc quyền (Privilege Escalation)
      if (context?.actorId) {
        const caller = await this.repository.findUserById(context.actorId);
        const isSuperAdmin = caller?.role?.isSystem && caller.role.name === ROLES.ADMIN;
        if (!isSuperAdmin) {
          const callerPerms = new Set(
            await permissionCacheService.getUserPermissions(context.actorId),
          );
          if (!callerPerms.has(PERMISSIONS.ROLE_PERMISSION_ASSIGN)) {
            throw new AppError(
              "Forbidden: Cần có quyền ROLE_PERMISSION_ASSIGN để gán quyền khi tạo vai trò",
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
          for (const perm of validPermissions) {
            if (!callerPerms.has(perm.name)) {
              throw new AppError(
                `Privilege Escalation: Bạn không thể cấp quyền '${perm.name}' cho vai trò mới vì chính bạn không sở hữu quyền này`,
                403,
                ERROR_CODE.FORBIDDEN,
              );
            }
          }
        }
      }
    }

    const role = await this.repository.createRole(data);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.CREATE_ROLE,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: role.id,
      details: {
        name: role.name,
        description: role.description,
        permissionsCount: data.permissionIds?.length || 0,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.findRoleById(role.id);
  }

  async updateRole(
    id: string,
    data: UpdateRoleDto,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await this.findRoleById(id);

    if (data.name && data.name !== role.name) {
      if (role.isSystem) {
        throw new AppError(
          "Cannot rename system role",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const existing = await this.repository.findRoleByName(data.name);
      if (existing && existing.id !== id) {
        throw new AppError(
          `Role with name '${data.name}' already exists`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    const updated = await this.repository.updateRole(id, data);
    permissionCacheService.invalidateRole(id);

    await this.repository.createAuditLog({
      actorId: context?.actorId,
      action: AUDIT_ACTION.UPDATE_ROLE,
      targetType: AUDIT_TARGET_TYPE.ROLE,
      targetId: id,
      details: {
        previous: { name: role.name, description: role.description },
        updated: data,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.findRoleById(updated.id);
  }

  async deleteRole(
    id: string,
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await this.findRoleById(id);

    if (role.isSystem) {
      throw new AppError(
        "Cannot delete system role",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (role.userCount > 0) {
      throw new AppError(
        `Cannot delete role '${role.name}' because it currently has ${role.userCount} assigned users. Reassign users first.`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
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

  async findAllPermissions(query?: {
    page?: number;
    limit?: number;
    resource?: string;
  }) {
    return this.repository.findAllPermissions(query);
  }

  async syncRolePermissions(
    roleId: string,
    permissionIds: string[],
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await this.findRoleById(roleId);

    const validPermissions =
      await this.repository.findPermissionsByIds(permissionIds);
    if (validPermissions.length !== permissionIds.length) {
      throw new AppError(
        "One or more permission IDs are invalid",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // SEC-P0: Chống leo thang đặc quyền khi gán permissions vào role
    if (context?.actorId) {
      const caller = await this.repository.findUserById(context.actorId);
      const isSuperAdmin = caller?.role?.isSystem && caller.role.name === ROLES.ADMIN;
      if (!isSuperAdmin) {
        const callerPerms = new Set(
          await permissionCacheService.getUserPermissions(context.actorId),
        );
        for (const perm of validPermissions) {
          if (!callerPerms.has(perm.name)) {
            throw new AppError(
              `Privilege Escalation: Bạn không thể cấp quyền '${perm.name}' cho vai trò vì chính bạn không sở hữu quyền này`,
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
        }
      }
    }

    // Anti-lockout protection: ADMIN role must retain ROLE_PERMISSION_ASSIGN
    if (role.isSystem && (role.name === ROLES.ADMIN || role.name === "ADMIN")) {
      const assignPerm = await this.repository.findPermissionByName(
        PERMISSIONS.ROLE_PERMISSION_ASSIGN,
      );
      if (assignPerm && !permissionIds.includes(assignPerm.id)) {
        throw new AppError(
          "Security Violation: Cannot revoke ROLE_PERMISSION_ASSIGN permission from the ADMIN role.",
          400,
          ERROR_CODE.VALIDATION_ERROR,
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
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await this.findRoleById(roleId);

    // Anti-lockout protection: ADMIN role must retain ROLE_PERMISSION_ASSIGN
    if (role.name === ROLES.ADMIN) {
      const assignPerm = await this.repository.findPermissionByName(
        PERMISSIONS.ROLE_PERMISSION_ASSIGN,
      );
      if (assignPerm && assignPerm.id === permissionId) {
        throw new AppError(
          "Security Violation: Cannot revoke ROLE_PERMISSION_ASSIGN permission from the ADMIN role.",
          400,
          ERROR_CODE.VALIDATION_ERROR,
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
    context?: { actorId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const targetRole = await this.findRoleById(newRoleId);
    const currentUser = await this.repository.findUserById(userId);
    if (!currentUser) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // SEC-P0: Chống tự phong quyền (Self-role assignment)
    if (context?.actorId && context.actorId === userId) {
      throw new AppError(
        "Security Violation: Không được phép tự gán hoặc thay đổi vai trò của chính mình",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // SEC-P0: Chống leo thang đặc quyền khi gán vai trò người dùng
    if (context?.actorId) {
      const caller = await this.repository.findUserById(context.actorId);
      const isSuperAdmin = caller?.role?.isSystem && caller.role.name === ROLES.ADMIN;
      if (!isSuperAdmin) {
        const callerPerms = new Set(
          await permissionCacheService.getUserPermissions(context.actorId),
        );
        const targetPermissions = await permissionCacheService.getRolePermissions(
          targetRole.id,
        );
        for (const perm of targetPermissions) {
          if (!callerPerms.has(perm)) {
            throw new AppError(
              `Privilege Escalation: Bạn không thể gán vai trò '${targetRole.name}' vì vai trò này sở hữu quyền '${perm}' vượt quá đặc quyền của bạn`,
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
        }
      }
    }

    // Anti-lockout guard: Ngăn chặn hạ quyền Quản trị viên (Admin) duy nhất
    if (
      currentUser.isActive &&
      !currentUser.deletedAt &&
      currentUser.roleId !== targetRole.id
    ) {
      const currentPermissions = currentUser.roleId
        ? await permissionCacheService.getRolePermissions(currentUser.roleId)
        : new Set<string>();
      const isCurrentAdmin =
        currentUser.role?.name === ROLES.ADMIN ||
        currentPermissions.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
        currentPermissions.has(PERMISSIONS.ROLE_PERMISSION_ASSIGN);

      const targetPermissions = await permissionCacheService.getRolePermissions(
        targetRole.id,
      );
      const isTargetAdmin =
        targetRole.name === ROLES.ADMIN ||
        targetPermissions.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
        targetPermissions.has(PERMISSIONS.ROLE_PERMISSION_ASSIGN);

      if (isCurrentAdmin && !isTargetAdmin) {
        const activeAdminsCount = await userRepository.countActiveAdmins(
          currentUser.role?.name,
        );
        if (activeAdminsCount <= 1) {
          throw new AppError(
            "Không thể hạ quyền Quản trị viên (Admin) duy nhất trong hệ thống",
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
      }
    }

    const oldRoleId = currentUser.roleId;

    const user = await this.repository.assignUserRole(userId, targetRole.id);
    if (oldRoleId && oldRoleId !== targetRole.id) {
      permissionCacheService.invalidateRole(oldRoleId);
    }
    permissionCacheService.invalidateRole(user.roleId);
    permissionCacheService.invalidateUser(userId);

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
    notificationDispatcher
      .notify(
        userId,
        NOTIFICATION_TYPE.INFO,
        "Cập nhật vai trò tài khoản",
        `Vai trò tài khoản của bạn đã được cập nhật thành: ${targetRole.name}.`,
        { priority: NOTIFICATION_PRIORITY.HIGH },
      )
      .catch((err) => console.error("Failed to notify role assignment:", err));

    return user;
  }

  async findAllAuditLogs(query: AuditLogQueryDto) {
    return this.repository.findAllAuditLogs(query);
  }
}
