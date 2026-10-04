import { DepartmentRepository } from "./department.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
  DepartmentQueryDto,
  DepartmentDto,
  PositionDto,
  DepartmentManagerDto,
  AssignDepartmentManagerDto,
  UpdateDepartmentManagerDto,
} from "./department.dto";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { discordBotService } from "../../common/services/discord-bot.service";

export class DepartmentService {
  private readonly repository = new DepartmentRepository();

  async findAll(
    user?: { id: string; role?: string },
    filters?: DepartmentQueryDto,
  ): Promise<DepartmentDto[]> {
    if (user) {
      const callerPerms = new Set(
        await permissionCacheService.getUserPermissions(user.id),
      );
      const hasGlobalAccess =
        callerPerms.has(PERMISSIONS.DEPARTMENT_CREATE) ||
        callerPerms.has(PERMISSIONS.DEPARTMENT_DELETE) ||
        callerPerms.has(PERMISSIONS.ROLE_READ) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

      if (!hasGlobalAccess) {
        const departmentIds =
          await this.repository.findDepartmentIdsByLeaderUserId(user.id);
        if (departmentIds.length === 0) {
          return [];
        }
        return this.repository.findAll(departmentIds, filters);
      }
    }

    return this.repository.findAll(undefined, filters);
  }

  async findById(id: string): Promise<DepartmentDto> {
    const dept = await this.repository.findById(id);
    if (!dept) {
      throw new AppError("Department not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return dept;
  }

  async create(
    data: CreateDepartmentDto,
    actorId?: string,
  ): Promise<DepartmentDto> {
    const existing = await this.repository.findByName(data.name);
    if (existing) {
      throw new AppError(
        "Tên phòng ban đã tồn tại trong hệ thống",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const result = await this.repository.create(data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_DEPARTMENT,
      targetType: AUDIT_TARGET_TYPE.DEPARTMENT,
      targetId: result.id,
      details: { name: result.name },
    });

    // Zero-Touch Discord Bot Provisioning (Tạo Role & Private Thread trên Discord)
    try {
      await discordBotService.provisionDepartment({
        departmentId: result.id,
        departmentName: result.name,
      });
    } catch (err: any) {
      console.warn(
        `[DepartmentService] Auto-provision Discord for ${result.name} warning:`,
        err?.message,
      );
    }

    return result;
  }

  async update(
    id: string,
    data: UpdateDepartmentDto,
    actorId?: string,
  ): Promise<DepartmentDto> {
    await this.findById(id);

    if (data.name) {
      const existing = await this.repository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new AppError(
          "Tên phòng ban đã tồn tại trong hệ thống",
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    const result = await this.repository.update(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_DEPARTMENT,
      targetType: AUDIT_TARGET_TYPE.DEPARTMENT,
      targetId: result.id,
      details: { name: result.name },
    });

    return result;
  }

  async delete(id: string, actorId?: string): Promise<DepartmentDto> {
    const dept = await this.findById(id);

    const hasLinked = await this.repository.hasAssociations(id);
    if (hasLinked) {
      throw new AppError(
        "Không thể xóa phòng ban do đang có thực tập sinh hoặc leader trực thuộc.",
        400,
        ERROR_CODE.DEPENDENCY_ERROR,
      );
    }

    const result = await this.repository.softDelete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_DEPARTMENT,
      targetType: AUDIT_TARGET_TYPE.DEPARTMENT,
      targetId: id,
      details: { name: dept.name },
    });

    // Zero-Touch Discord Bot Cleanup (Xóa Role & Private Thread trên Discord)
    try {
      await discordBotService.deprovisionDepartment(id);
    } catch (err: any) {
      console.warn(
        `[DepartmentService] Auto-deprovision Discord for ${dept.name} warning:`,
        err?.message,
      );
    }

    return result;
  }

  // ─── Positions ───────────────────────────────────────────────────

  async findPositionsByDepartment(departmentId: string): Promise<PositionDto[]> {
    await this.findById(departmentId);
    return this.repository.findPositionsByDepartment(departmentId);
  }

  async createPosition(
    data: CreatePositionDto,
    actorId?: string,
  ): Promise<PositionDto> {
    await this.findById(data.departmentId);

    const result = await this.repository.createPosition(data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_POSITION,
      targetType: AUDIT_TARGET_TYPE.POSITION,
      targetId: result.id,
      details: {
        name: result.name,
        departmentId: result.departmentId,
      },
    });

    return result;
  }

  async updatePosition(
    id: string,
    data: UpdatePositionDto,
    actorId?: string,
  ): Promise<PositionDto> {
    const pos = await this.repository.findPositionById(id);
    if (!pos) {
      throw new AppError("Position not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (data.departmentId) {
      await this.findById(data.departmentId);
    }

    const result = await this.repository.updatePosition(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_POSITION,
      targetType: AUDIT_TARGET_TYPE.POSITION,
      targetId: result.id,
      details: {
        name: result.name,
        departmentId: result.departmentId,
      },
    });

    return result;
  }

  async deletePosition(id: string, actorId?: string): Promise<PositionDto> {
    const pos = await this.repository.findPositionById(id);
    if (!pos) {
      throw new AppError("Position not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const hasLinked = await this.repository.hasPositionAssociations(id);
    if (hasLinked) {
      throw new AppError(
        "Không thể xóa vị trí do đang có thực tập sinh trực thuộc.",
        400,
        ERROR_CODE.DEPENDENCY_ERROR,
      );
    }

    const result = await this.repository.deletePosition(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_POSITION,
      targetType: AUDIT_TARGET_TYPE.POSITION,
      targetId: id,
      details: {
        name: pos.name,
        departmentId: pos.departmentId,
      },
    });

    return result;
  }

  // ─── Department Managers ──────────────────────────────────────────

  async findManagers(departmentId: string): Promise<DepartmentManagerDto[]> {
    await this.findById(departmentId);
    return this.repository.findManagersByDepartmentId(departmentId);
  }

  async assignManager(
    departmentId: string,
    data: AssignDepartmentManagerDto,
    actorId?: string,
  ): Promise<DepartmentManagerDto> {
    const dept = await this.findById(departmentId);

    const user = await this.repository.findActiveUserById(data.userId);
    if (!user) {
      throw new AppError(
        "Người dùng không tồn tại hoặc không ở trạng thái hoạt động",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const portalType = user.role?.portalType;
    if (portalType && portalType !== "LEADER" && portalType !== "ADMIN") {
      throw new AppError(
        "Chỉ người dùng có quyền Leader hoặc Admin mới có thể làm người phụ trách phòng ban",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const existingInDept = await this.repository.findManager(departmentId, data.userId);
    if (!existingInDept) {
      const managedCount = await this.repository.countDepartmentsManagedByUser(data.userId);
      if (managedCount >= 3) {
        throw new AppError(
          "Một người phụ trách chỉ được quản lý tối đa 3 phòng ban cùng lúc",
          400,
          ERROR_CODE.CAPACITY_EXCEEDED,
        );
      }
    }

    const result = await this.repository.assignManager(departmentId, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.ASSIGN_DEPARTMENT_MANAGER,
      targetType: AUDIT_TARGET_TYPE.DEPARTMENT,
      targetId: departmentId,
      details: {
        userId: data.userId,
        departmentName: dept.name,
        isPrimary: data.isPrimary,
        title: data.title,
      },
    });

    return result;
  }

  async updateManager(
    departmentId: string,
    userId: string,
    data: UpdateDepartmentManagerDto,
    actorId?: string,
  ): Promise<DepartmentManagerDto> {
    await this.findById(departmentId);
    const existing = await this.repository.findManager(departmentId, userId);
    if (!existing) {
      throw new AppError(
        "Người phụ trách không thuộc phòng ban này",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const result = await this.repository.updateManager(departmentId, userId, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_DEPARTMENT_MANAGER,
      targetType: AUDIT_TARGET_TYPE.DEPARTMENT,
      targetId: departmentId,
      details: {
        userId,
        isPrimary: data.isPrimary,
        title: data.title,
      },
    });

    return result;
  }

  async removeManager(
    departmentId: string,
    userId: string,
    actorId?: string,
  ): Promise<void> {
    await this.findById(departmentId);
    const existing = await this.repository.findManager(departmentId, userId);
    if (!existing) {
      throw new AppError(
        "Người phụ trách không thuộc phòng ban này",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    await this.repository.removeManager(departmentId, userId);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.REMOVE_DEPARTMENT_MANAGER,
      targetType: AUDIT_TARGET_TYPE.DEPARTMENT,
      targetId: departmentId,
      details: { userId },
    });
  }
}

