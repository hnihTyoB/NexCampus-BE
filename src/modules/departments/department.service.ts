import { DepartmentRepository } from "./department.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
} from "./department.dto";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

export class DepartmentService {
  private readonly repository = new DepartmentRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(user?: { id: string; role: string }, filters?: { name?: string; leader?: string }) {
    if (user?.role === "LEADER") {
      const departmentIds = await this.repository.findDepartmentIdsByLeaderUserId(user.id);
      if (departmentIds.length === 0) {
        return [];
      }
      return this.repository.findAll(departmentIds, filters);
    }
    return this.repository.findAll(undefined, filters);
  }

  async findById(id: string) {
    const dept = await this.repository.findById(id);
    if (!dept) {
      throw new AppError("Department not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return dept;
  }

  async create(data: CreateDepartmentDto, actorId: string) {
    const result = await this.repository.create(data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.CREATE_DEPARTMENT,
      `Đã tạo phòng ban mới: ${result.name}`,
      result.id,
      "Department"
    );

    return result;
  }

  async update(id: string, data: UpdateDepartmentDto, actorId: string) {
    await this.findById(id);
    const result = await this.repository.update(id, data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_DEPARTMENT,
      `Đã cập nhật phòng ban: ${result.name}`,
      result.id,
      "Department"
    );

    return result;
  }

  async delete(id: string, actorId: string) {
    const dept = await this.findById(id);
    const hasLinked = await this.repository.hasAssociations(id);
    if (hasLinked) {
      throw new AppError(
        "Cannot delete department because it is associated with active interns, leaders, or applications.",
        400,
        ERROR_CODE.DEPENDENCY_ERROR
      );
    }
    const result = await this.repository.delete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_DEPARTMENT,
      `Đã xóa phòng ban: ${dept.name}`,
      id,
      "Department"
    );

    return result;
  }

  // ─── Positions ───────────────────────────────────────────────────

  async findPositionsByDepartment(departmentId: string) {
    await this.findById(departmentId);
    return this.repository.findPositionsByDepartment(departmentId);
  }

  async createPosition(data: CreatePositionDto, actorId: string) {
    await this.findById(data.departmentId);
    const result = await this.repository.createPosition(data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.CREATE_POSITION,
      `Đã tạo vị trí mới: ${result.name}`,
      result.id,
      "Position"
    );

    return result;
  }

  async updatePosition(id: string, data: UpdatePositionDto, actorId: string) {
    const pos = await this.repository.findPositionById(id);
    if (!pos) {
      throw new AppError("Position not found", 404, ERROR_CODE.NOT_FOUND);
    }
    if (data.departmentId) {
      await this.findById(data.departmentId);
    }
    const result = await this.repository.updatePosition(id, data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_POSITION,
      `Đã cập nhật vị trí: ${result.name}`,
      result.id,
      "Position"
    );

    return result;
  }

  async deletePosition(id: string, actorId: string) {
    const pos = await this.repository.findPositionById(id);
    if (!pos) {
      throw new AppError("Position not found", 404, ERROR_CODE.NOT_FOUND);
    }
    const hasLinked = await this.repository.hasPositionAssociations(id);
    if (hasLinked) {
      throw new AppError(
        "Cannot delete position because it is associated with active interns or applications.",
        400,
        ERROR_CODE.DEPENDENCY_ERROR
      );
    }
    const result = await this.repository.deletePosition(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_POSITION,
      `Đã xóa vị trí: ${pos.name}`,
      id,
      "Position"
    );

    return result;
  }
}
