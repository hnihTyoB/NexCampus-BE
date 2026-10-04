import { TaskGroupRepository } from "./task-group.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateTaskGroupDto,
  UpdateTaskGroupDto,
  TaskGroupQueryDto,
  TaskGroupDto,
  TaskGroupProgressDto,
} from "./task-group.dto";
import { prisma } from "../../database/prisma.client";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";

interface UserContext {
  id: string;
  email?: string | null;
  role?: string;
  roleId?: string;
  permissions?: string[];
}

export class TaskGroupService {
  private readonly repository = new TaskGroupRepository();

  private async hasGlobalAccess(userId: string, permissions?: string[]): Promise<boolean> {
    const callerPerms = new Set(
      permissions ?? (await permissionCacheService.getUserPermissions(userId)),
    );
    return (
      callerPerms.has(PERMISSIONS.ROLE_READ) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN)
    );
  }

  async findAll(query: TaskGroupQueryDto, user?: UserContext) {
    if (user) {
      const hasGlobal = await this.hasGlobalAccess(user.id, user.permissions);
      if (!hasGlobal) {
        if (user.role !== "LEADER") {
          const profile = await prisma.internshipProfile.findUnique({
            where: { userId: user.id },
            select: { id: true, userId: true },
          });
          if (profile) {
            return this.repository.findAll(query, { internId: profile.userId });
          }
          if (user.role === "INTERN") {
            return {
              data: [],
              meta: {
                total: 0,
                page: query.page ?? 1,
                limit: query.limit ?? 20,
                totalPages: 1,
              },
            };
          }
        }

        if (user.role !== "INTERN") {
          const managedDepts = await prisma.departmentManager.findMany({
            where: { userId: user.id },
            select: { departmentId: true },
          });
          if (managedDepts.length > 0) {
            const departmentIds = managedDepts.map((d: { departmentId: string }) => d.departmentId);
            return this.repository.findAll(query, {
              leaderScope: {
                departmentIds,
                leaderUserId: user.id,
              },
            });
          }
          if (user.role === "LEADER") {
            return {
              data: [],
              meta: {
                total: 0,
                page: query.page ?? 1,
                limit: query.limit ?? 20,
                totalPages: 1,
              },
            };
          }
        }

        return {
          data: [],
          meta: {
            total: 0,
            page: query.page ?? 1,
            limit: query.limit ?? 20,
            totalPages: 1,
          },
        };
      }
    }

    return this.repository.findAll(query);
  }

  async findById(id: string, user?: UserContext): Promise<TaskGroupDto> {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new AppError("Task group not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user) {
      const hasGlobal = await this.hasGlobalAccess(user.id);
      if (!hasGlobal) {
        const isMember = (group as any).members?.some((m: any) => m.userId === user.id || m.internId === user.id);
        if (isMember) {
          return group as unknown as TaskGroupDto;
        }

        const managedDepts = await prisma.departmentManager.findMany({
          where: { userId: user.id },
          select: { departmentId: true },
        });
        const deptIds = managedDepts.map((d: { departmentId: string }) => d.departmentId);
        const isDeptGroup = Boolean(
          group.departmentId && deptIds.includes(group.departmentId),
        );
        const hasOwnMember = Boolean(
          (group as any).members?.some((m: any) => m.intern?.leaderId === user.id || m.user?.internshipProfile?.mentorId === user.id),
        );
        if (!isDeptGroup && !hasOwnMember) {
          throw new AppError(
            "You do not have access to this task group",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    return group as unknown as TaskGroupDto;

  }

  private async validateMembers(
    memberIds: string[],
    departmentId: string | null | undefined,
    user?: UserContext,
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

    let allowedDepartmentIds: string[] | undefined = undefined;
    if (user) {
      const hasGlobal = await this.hasGlobalAccess(user.id);
      if (!hasGlobal) {
        const managedDepts = await prisma.departmentManager.findMany({
          where: { userId: user.id },
          select: { departmentId: true },
        });
        if (managedDepts.length > 0) {
          allowedDepartmentIds = managedDepts.map((d: { departmentId: string }) => d.departmentId);
        }
      }
    }

    const validMembers = await prisma.internshipProfile.findMany({
      where: {
        userId: { in: uniqueMemberIds },
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
        ...(departmentId ? { departmentId } : {}),
        ...(allowedDepartmentIds !== undefined
          ? {
              OR: [
                { mentorId: user?.id },
                { departmentId: { in: allowedDepartmentIds } },
              ],
            }
          : {}),
      },
      select: { userId: true },
    });

    if (validMembers.length !== uniqueMemberIds.length) {
      throw new AppError(
        "Thành viên Task Group phải là TTS active và thuộc đúng phòng ban/leader phụ trách",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }

  async create(
    data: CreateTaskGroupDto,
    actorId?: string,
    user?: UserContext,
    context?: { ipAddress?: string },
  ) {
    if (user && data.departmentId) {
      const hasGlobal = await this.hasGlobalAccess(user.id);
      if (!hasGlobal) {
        const managedDepts = await prisma.departmentManager.findMany({
          where: { userId: user.id },
          select: { departmentId: true },
        });
        const deptIds = managedDepts.map((d: { departmentId: string }) => d.departmentId);
        if (deptIds.length > 0 && !deptIds.includes(data.departmentId)) {
          throw new AppError(
            "Leader chỉ được tạo nhóm trong phòng ban mình quản lý",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    const existing = await this.repository.findByNameAndDepartment(
      data.name,
      data.departmentId ?? null,
    );
    if (existing) {
      throw new AppError(
        "Tên nhóm công việc đã tồn tại trong phòng ban này",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    await this.validateMembers(data.memberIds ?? [], data.departmentId, user);
    const result = await this.repository.create(data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_TASK_GROUP,
      targetType: AUDIT_TARGET_TYPE.TASK_GROUP,
      targetId: result.id,
      details: { name: result.name, departmentId: result.departmentId },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async update(
    id: string,
    data: UpdateTaskGroupDto,
    actorId?: string,
    user?: UserContext,
    context?: { ipAddress?: string },
  ) {
    const group = await this.findById(id, user);

    if (data.name || data.departmentId !== undefined) {
      const nextName = data.name ?? group.name;
      const nextDept =
        data.departmentId !== undefined ? data.departmentId : group.departmentId;
      const existing = await this.repository.findByNameAndDepartment(
        nextName,
        nextDept ?? null,
      );
      if (existing && existing.id !== id) {
        throw new AppError(
          "Tên nhóm công việc đã tồn tại trong phòng ban này",
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    const memberIds =
      data.memberIds ?? group.members?.map((member) => member.internId) ?? [];
    const departmentId =
      data.departmentId !== undefined ? data.departmentId : group.departmentId;
    await this.validateMembers(memberIds, departmentId, user);

    const result = await this.repository.update(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_TASK_GROUP,
      targetType: AUDIT_TARGET_TYPE.TASK_GROUP,
      targetId: id,
      details: { name: result.name, departmentId: result.departmentId },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async delete(
    id: string,
    actorId?: string,
    user?: UserContext,
    context?: { ipAddress?: string },
  ) {
    const group = await this.findById(id, user);
    const result = await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_TASK_GROUP,
      targetType: AUDIT_TARGET_TYPE.TASK_GROUP,
      targetId: id,
      details: { name: group.name },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async getProgress(id: string, user?: UserContext): Promise<TaskGroupProgressDto> {
    await this.findById(id, user);
    return this.repository.getProgress(id);
  }

  async findTasks(id: string, user?: UserContext) {
    await this.findById(id, user);
    return this.repository.findTasks(id);
  }
}
