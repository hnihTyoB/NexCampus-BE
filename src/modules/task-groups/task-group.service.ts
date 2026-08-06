import { TaskGroupRepository } from "./task-group.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { CreateTaskGroupDto, UpdateTaskGroupDto } from "./task-group.dto";
import { prisma } from "../../database/prisma.client";
import { ROLES } from "../../common/constants/role.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class TaskGroupService {
  private readonly repository = new TaskGroupRepository();

  async findAll(user: UserPayload) {
    // LEADER: chỉ thấy Task Groups thuộc phòng ban mình quản lý (hoặc không có phòng ban)
    if (user.role === ROLES.LEADER) {
      const leader = await prisma.leader.findFirst({
        where: { userId: user.id },
        select: { departments: { select: { departmentId: true } } },
      });
      const departmentIds = leader?.departments.map((d) => d.departmentId) ?? [];
      return this.repository.findAll(departmentIds);
    }
    // ADMIN: trả về tất cả
    return this.repository.findAll();
  }

  async findById(id: string) {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new AppError("Task group not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return group;
  }

  private async validateMembers(
    memberIds: string[],
    departmentId: string | null | undefined,
    user: UserPayload,
  ) {
    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length !== memberIds.length) {
      throw new AppError(
        "Danh sách thành viên có TTS bị trùng",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (uniqueMemberIds.length === 0) return;

    const validMembers = await prisma.intern.findMany({
      where: {
        id: { in: uniqueMemberIds },
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
        ...(departmentId ? { departmentId } : {}),
        ...(user.role === ROLES.LEADER ? { leaderId: user.id } : {}),
      },
      select: { id: true },
    });

    if (validMembers.length !== uniqueMemberIds.length) {
      throw new AppError(
        "Thành viên Task Group phải là TTS active, thuộc đúng leader và phòng ban đã chọn",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }

  async create(data: CreateTaskGroupDto, user: UserPayload) {
    await this.validateMembers(data.memberIds ?? [], data.departmentId, user);
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateTaskGroupDto, user: UserPayload) {
    const group = await this.findById(id);
    const memberIds = data.memberIds ?? group.members?.map((member) => member.internId) ?? [];
    const departmentId =
      data.departmentId !== undefined ? data.departmentId : group.departmentId;
    await this.validateMembers(memberIds, departmentId, user);
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
