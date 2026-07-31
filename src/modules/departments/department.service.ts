import { DepartmentRepository } from "./department.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
} from "./department.dto";

export class DepartmentService {
  private readonly repository = new DepartmentRepository();

  async findAll(user?: { id: string; role: string }, filters?: { name?: string; leader?: string }) {
    if (user?.role === "LEADER") {
      const departmentId = await this.repository.findDepartmentIdByLeaderUserId(user.id);
      if (!departmentId) {
        return [];
      }
      return this.repository.findAll(departmentId, filters);
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

  async create(data: CreateDepartmentDto) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateDepartmentDto) {
    await this.findById(id);
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    const hasLinked = await this.repository.hasAssociations(id);
    if (hasLinked) {
      throw new AppError(
        "Cannot delete department because it is associated with active interns, leaders, or applications.",
        400,
        ERROR_CODE.DEPENDENCY_ERROR
      );
    }
    return this.repository.delete(id);
  }

  // ─── Positions ───────────────────────────────────────────────────

  async findPositionsByDepartment(departmentId: string) {
    await this.findById(departmentId);
    return this.repository.findPositionsByDepartment(departmentId);
  }

  async createPosition(data: CreatePositionDto) {
    await this.findById(data.departmentId);
    return this.repository.createPosition(data);
  }

  async updatePosition(id: string, data: UpdatePositionDto) {
    const pos = await this.repository.findPositionById(id);
    if (!pos) {
      throw new AppError("Position not found", 404, ERROR_CODE.NOT_FOUND);
    }
    if (data.departmentId) {
      await this.findById(data.departmentId);
    }
    return this.repository.updatePosition(id, data);
  }

  async deletePosition(id: string) {
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
    return this.repository.deletePosition(id);
  }
}
