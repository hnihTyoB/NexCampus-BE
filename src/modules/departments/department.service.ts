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
} from "./department.dto";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { ROLES } from "../../common/constants/role.constant";

export class DepartmentService {
  private readonly repository = new DepartmentRepository();

  async findAll(
    user?: { id: string; role?: string },
    filters?: DepartmentQueryDto,
  ): Promise<DepartmentDto[]> {
    if (user?.role === ROLES.LEADER) {
      const departmentIds =
        await this.repository.findDepartmentIdsByLeaderUserId(user.id);
      if (departmentIds.length === 0) {
        return [];
      }
      return this.repository.findAll(departmentIds, filters);
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
}
