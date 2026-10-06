import { TaskGroupRepository } from "./task-group.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateTaskGroupDto,
  UpdateTaskGroupDto,
  TaskGroupQueryDto,
  TaskGroupDto,
  TaskGroupProgressDto,
  GroupAiRecommendationDto,
  ConfirmGroupAllocationPayloadDto,
} from "./task-group.dto";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { taskAllocationAiService } from "../tasks/task-allocation.ai.service";

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
          const profile = await this.repository.findInternshipProfileByUserId(user.id);
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
          const departmentIds = await this.repository.getLeaderDepartmentIds(user.id);
          if (departmentIds.length > 0) {
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
        const isMember = (group as any).members?.some(
          (m: any) => m.userId === user.id || m.internId === user.id,
        );
        if (isMember) {
          return group as unknown as TaskGroupDto;
        }

        const deptIds = await this.repository.getLeaderDepartmentIds(user.id);
        const isDeptGroup = Boolean(
          group.departmentId && deptIds.includes(group.departmentId),
        );
        const hasOwnMember = Boolean(
          (group as any).members?.some(
            (m: any) =>
              m.intern?.leaderId === user.id ||
              m.user?.internshipProfile?.mentorId === user.id,
          ),
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
  ): Promise<string[]> {
    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length !== memberIds.length) {
      throw new AppError(
        "Danh sách thành viên có TTS bị trùng",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (uniqueMemberIds.length === 0) return [];

    let allowedDepartmentIds: string[] | undefined = undefined;
    if (user) {
      const hasGlobal = await this.hasGlobalAccess(user.id);
      if (!hasGlobal) {
        allowedDepartmentIds = await this.repository.getLeaderDepartmentIds(user.id);
      }
    }

    const validMembers = await this.repository.findActiveInternshipProfiles(
      uniqueMemberIds,
      departmentId,
      allowedDepartmentIds,
      user?.id,
    );

    if (validMembers.length !== uniqueMemberIds.length) {
      throw new AppError(
        "Thành viên Task Group phải là TTS active và thuộc đúng phòng ban/leader phụ trách",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const memberMap = new Map<string, string>();
    validMembers.forEach((vm) => {
      memberMap.set(vm.id, vm.userId);
      memberMap.set(vm.userId, vm.userId);
    });
    return memberIds.map((id) => memberMap.get(id) || id);
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
        const deptIds = await this.repository.getLeaderDepartmentIds(user.id);
        if (!deptIds.includes(data.departmentId)) {
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

    const validatedMemberIds = data.memberIds
      ? await this.validateMembers(data.memberIds, data.departmentId, user)
      : undefined;
    const result = await this.repository.create({
      ...data,
      ...(validatedMemberIds ? { memberIds: validatedMemberIds } : {}),
    });

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

    if (data.departmentId !== undefined && data.departmentId !== group.departmentId) {
      if (user && data.departmentId !== null) {
        const hasGlobal = await this.hasGlobalAccess(user.id);
        if (!hasGlobal) {
          const deptIds = await this.repository.getLeaderDepartmentIds(user.id);
          if (!deptIds.includes(data.departmentId)) {
            throw new AppError(
              "Leader chỉ được cập nhật nhóm trong phòng ban mình quản lý",
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
        }
      }
    }

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

    let validatedMemberIds: string[] | undefined = undefined;
    if (data.memberIds !== undefined) {
      const departmentId =
        data.departmentId !== undefined ? data.departmentId : group.departmentId;
      validatedMemberIds = await this.validateMembers(data.memberIds, departmentId, user);
    } else if (
      data.departmentId !== undefined &&
      data.departmentId !== group.departmentId &&
      group.members &&
      group.members.length > 0
    ) {
      const existingMemberIds = group.members.map((m: any) => m.userId || m.internId);
      validatedMemberIds = await this.validateMembers(
        existingMemberIds,
        data.departmentId,
        user,
      );
    }

    const result = await this.repository.update(id, {
      ...data,
      ...(validatedMemberIds !== undefined ? { memberIds: validatedMemberIds } : {}),
    });

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

  async getGroupAiRecommendation(
    taskGroupId: string,
    user?: UserContext,
  ): Promise<GroupAiRecommendationDto> {
    const group = await this.findById(taskGroupId, user);
    const unassignedTasks = await this.repository.findUnassignedTasks(taskGroupId);
    const memberRecords = await this.repository.findGroupMemberCandidates(taskGroupId);

    const candidates = memberRecords.map((m) => {
      const p = m.user.internshipProfile;
      const activeTaskDays = (m.user.assignedTasks || []).reduce(
        (acc: number, curr: { task: { estDays: number | null } | null }) =>
          acc + (curr.task?.estDays || 1),
        0,
      );
      return {
        id: m.userId,
        fullName: m.user.fullName || "Thực tập sinh",
        position: p?.position ? { name: p.position.name } : undefined,
        activeTaskDays,
      };
    });

    const evaluatedTasks = unassignedTasks.map((task) => {
      if (candidates.length === 0) {
        return {
          taskId: task.id,
          taskTitle: task.title,
          taskCode: task.code,
          priority: task.priority,
          estDays: task.estDays,
          deadline: task.deadline ? task.deadline.toISOString() : "",
          suggestedOwner: null,
          suggestedSupport: null,
          reason: "Nhóm chưa có thành viên để phân công",
        };
      }

      const evaluated = taskAllocationAiService.evaluateAllocation({
        task: {
          title: task.title,
          description: task.description,
          module: task.module,
          priority: task.priority,
          estDays: task.estDays || 1,
          maxWorkloadDays: group.maxWorkloadDays || 10,
          deadline: task.deadline ? task.deadline.toISOString() : undefined,
        },
        candidates,
      });

      const ownerCandidate = candidates.find((c) => c.id === evaluated.recommendedOwnerId);
      const supportCandidate = evaluated.recommendedSupportId
        ? candidates.find((c) => c.id === evaluated.recommendedSupportId)
        : null;

      return {
        taskId: task.id,
        taskTitle: task.title,
        taskCode: task.code,
        priority: task.priority,
        estDays: task.estDays,
        deadline: task.deadline ? task.deadline.toISOString() : "",
        suggestedOwner: ownerCandidate
          ? {
              id: ownerCandidate.id,
              name: ownerCandidate.fullName,
              position: ownerCandidate.position?.name ?? null,
              compatibilityScore: 85,
              workloadDays: ownerCandidate.activeTaskDays + (task.estDays || 1),
            }
          : null,
        suggestedSupport: supportCandidate
          ? {
              id: supportCandidate.id,
              name: supportCandidate.fullName,
              position: supportCandidate.position?.name ?? null,
              compatibilityScore: 80,
              workloadDays: supportCandidate.activeTaskDays + (task.estDays || 1) * 0.5,
            }
          : null,
        reason:
          evaluated.reasons?.join("; ") || "Phân công tối ưu theo workload và năng lực",
      };
    });

    const totalAllocated = evaluatedTasks.filter((t) => t.suggestedOwner !== null).length;
    const allocatedOwnerIds = new Set(
      evaluatedTasks.map((t) => t.suggestedOwner?.id).filter(Boolean),
    );

    return {
      taskGroupId,
      taskGroupName: group.name,
      department: group.department
        ? { id: group.department.id, name: group.department.name }
        : null,
      tasks: evaluatedTasks,
      summary: {
        totalUnassignedTasks: unassignedTasks.length,
        totalAllocated,
        unallocatableTasks: unassignedTasks.length - totalAllocated,
        internsEvaluatedCount: candidates.length,
        membersUsedCount: allocatedOwnerIds.size,
        totalMemberCount: candidates.length,
      },
    };
  }

  async confirmGroupAiAllocation(
    taskGroupId: string,
    data: ConfirmGroupAllocationPayloadDto,
    actorId?: string,
    user?: UserContext,
    context?: { ipAddress?: string },
  ) {
    await this.findById(taskGroupId, user);

    const validAssignments: Array<{
      taskId: string;
      assigneeId: string;
      supportId?: string | null;
      assignedBy: string;
    }> = [];

    for (const a of data.assignments) {
      const isMember = await this.repository.isMember(taskGroupId, a.internId);
      if (!isMember) {
        throw new AppError(
          `Thành viên ${a.internId} không thuộc nhóm công việc này`,
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      validAssignments.push({
        taskId: a.taskId,
        assigneeId: a.internId,
        supportId: a.supportId ?? null,
        assignedBy: actorId || user?.id || "system",
      });
    }

    const results = await this.repository.createAssignmentsBulk(validAssignments);
    const count = results.length;

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_TASK_GROUP,
      targetType: AUDIT_TARGET_TYPE.TASK_GROUP,
      targetId: taskGroupId,
      details: { action: "CONFIRM_AI_ALLOCATION", assignedCount: count },
      ipAddress: context?.ipAddress,
    });

    return {
      success: true,
      message: `Đã phân công ${count} công việc thành công`,
      count,
    };
  }
}
