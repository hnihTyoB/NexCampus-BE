import { TaskAssignmentRepository } from "./task-assignment.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  AssignTaskDto,
  UpdateTaskAssignmentDto,
  RequestTaskExtensionDto,
  QueryExtensionRequestsDto,
} from "./task-assignment.dto";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  ASSIGNMENT_STATUS,
  ACTIVE_CAPACITY_STATUSES,
  EXTENSION_REQUEST_STATUS,
  SUPPORT_WORKLOAD_FACTOR,
  DEFAULT_MAX_WORKLOAD_DAYS,
  DEFAULT_TASK_DAYS,
} from "../../common/constants/task.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { AssignmentStatus } from "@prisma/client";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
} from "../../common/constants/notification.constant";

import { TaskRepository } from "../tasks/task.repository";
import { discordWebhookService } from "../../common/services/discord-webhook.service";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class TaskAssignmentService {
  private readonly repository = new TaskAssignmentRepository();
  private readonly taskRepository = new TaskRepository();

  private ensureAssignmentEditable(status: AssignmentStatus) {
    if (status === ASSIGNMENT_STATUS.DONE) {
      throw new AppError(
        "Completed tasks cannot be edited",
        409,
        ERROR_CODE.TASK_ALREADY_COMPLETED,
      );
    }
  }

  /**
   * Helper phân giải ID thực tập sinh hoặc User ID sang User.id chuẩn
   */
  async resolveAssigneeUserId(assigneeOrInternId?: string | null): Promise<string | undefined> {
    if (!assigneeOrInternId) return undefined;
    const user = await this.repository.findUserById(assigneeOrInternId);
    if (user) return user.id;

    const profile = await this.repository.findInternshipProfileById(assigneeOrInternId);
    if (profile) return profile.userId;

    return assigneeOrInternId;
  }

  /**
   * Kiểm tra xem actor có quyền quản lý / mentor đối với một user mục tiêu hoặc task không
   */
  private async isManagerOrMentor(
    actorId: string,
    targetUserId?: string | null,
    departmentId?: string | null,
  ): Promise<boolean> {
    if (targetUserId && actorId === targetUserId) {
      return true;
    }

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    if (
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_READ)
    ) {
      return true;
    }

    if (targetUserId) {
      const profile = await this.repository.findInternshipProfileByUserId(targetUserId);
      if (profile?.mentorId === actorId) {
        return true;
      }
      if (profile?.departmentId) {
        const isMgr = await this.repository.isDepartmentManager(profile.departmentId, actorId);
        if (isMgr) return true;
      }
    }

    if (departmentId) {
      const isDeptMgr = await this.repository.isDepartmentManager(departmentId, actorId);
      if (isDeptMgr) return true;
    }

    return false;
  }

  private async ensureAssigneeCapacity(
    userId: string,
    task: { id: string; title: string; estDays: number | null },
    role: "OWNER" | "SUPPORT" = "OWNER",
    excludeAssignmentId?: string,
  ) {
    const [taskWithLimits, activeAssignments] = await Promise.all([
      this.repository.findTaskById(task.id),
      this.repository.findActiveAssignmentsForUser(
        userId,
        ACTIVE_CAPACITY_STATUSES,
        excludeAssignmentId,
      ),
    ]);

    const maxWorkloadDays =
      taskWithLimits?.taskGroup?.maxWorkloadDays ?? DEFAULT_MAX_WORKLOAD_DAYS;
    const maxActiveTasks = taskWithLimits?.taskGroup?.maxActiveTasks ?? 5;

    const currentWorkloadDays = activeAssignments.reduce((total, assignment) => {
      const days = assignment.task.estDays ?? DEFAULT_TASK_DAYS;
      return (
        total +
        (assignment.assigneeId === userId
          ? days
          : days * SUPPORT_WORKLOAD_FACTOR)
      );
    }, 0);

    const taskEstDays = task.estDays ?? DEFAULT_TASK_DAYS;
    const addedDays =
      role === "OWNER" ? taskEstDays : taskEstDays * SUPPORT_WORKLOAD_FACTOR;
    const newWorkloadDays = currentWorkloadDays + addedDays;

    if (newWorkloadDays > maxWorkloadDays) {
      throw new AppError(
        `Vượt quá tải trọng tối đa cho phép (${newWorkloadDays.toFixed(1)} / ${maxWorkloadDays} ngày)`,
        400,
        ERROR_CODE.CAPACITY_EXCEEDED,
      );
    }

    if (activeAssignments.length >= maxActiveTasks) {
      throw new AppError(
        `Số lượng nhiệm vụ đang xử lý vượt quá giới hạn (${activeAssignments.length} / ${maxActiveTasks} nhiệm vụ)`,
        400,
        ERROR_CODE.CAPACITY_EXCEEDED,
      );
    }
  }

  private async validateTaskGroupMembership(
    taskGroupId: string,
    userId: string,
  ) {
    const isMember = await this.repository.isTaskGroupMember(taskGroupId, userId);

    if (!isMember) {
      throw new AppError(
        "Người dùng không thuộc nhóm nhiệm vụ này",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }

  async findAll(query: TaskAssignmentQueryDto, user?: UserPayload) {
    if (user) {
      const callerPerms = new Set(
        await permissionCacheService.getUserPermissions(user.id),
      );
      const hasGlobalAccess =
        callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
        callerPerms.has(PERMISSIONS.ROLE_READ);

      if (!hasGlobalAccess) {
        // Lấy danh sách phòng ban mà user quản lý và danh sách mentee
        const [departmentIds, mentees] = await Promise.all([
          this.repository.findManagedDepartmentIds(user.id),
          this.repository.findMenteeUserIds(user.id),
        ]);

        if (departmentIds.length > 0 || mentees.length > 0) {
          return this.repository.findAll(query, {
            departmentIds,
            leaderUserId: user.id,
          });
        }

        // Người dùng thông thường chỉ xem task được giao cho mình
        return this.repository.findAll(query, { userId: user.id });
      }
    }

    return this.repository.findAll(query);
  }

  async findById(id: string, user?: UserPayload) {
    const assignment = await this.repository.findById(id);
    if (!assignment) {
      throw new AppError("Task assignment not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user) {
      const isOwner = assignment.assigneeId === user.id || assignment.internId === user.id;
      const isSupport = assignment.supportId === user.id;
      const isAssigner = assignment.assignedBy === user.id;

      if (!isOwner && !isSupport && !isAssigner) {
        const isAllowed = await this.isManagerOrMentor(
          user.id,
          assignment.assigneeId,
          assignment.task?.taskGroup?.departmentId,
        );
        if (!isAllowed) {
          throw new AppError(
            "You are not authorized to view this assignment",
            403,
            ERROR_CODE.FORBIDDEN,
          );
        }
      }
    }

    return assignment;
  }

  async create(
    data: CreateTaskAssignmentDto,
    assignedBy: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const assigneeUserId = await this.resolveAssigneeUserId(data.assigneeId || data.internId);
    if (!assigneeUserId) {
      throw new AppError("assigneeId hoặc internId là bắt buộc", 400, ERROR_CODE.VALIDATION_ERROR);
    }
    const supportUserId = await this.resolveAssigneeUserId(data.supportId);

    // 1. Check Task
    const task = await this.repository.findTaskById(data.taskId);
    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Deadline validation
    if (task.deadline && new Date(task.deadline).getTime() < Date.now()) {
      throw new AppError(
        "Cannot assign a task whose deadline has already passed",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Check Task Group Membership if task belongs to a task group
    if (task.taskGroupId) {
      await this.validateTaskGroupMembership(task.taskGroupId, assigneeUserId);
      if (supportUserId) {
        await this.validateTaskGroupMembership(task.taskGroupId, supportUserId);
      }
    }

    // 4. Check Assignee user & profile
    const targetUser = await this.repository.findUserById(assigneeUserId);
    if (!targetUser) {
      throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (!targetUser.isActive) {
      throw new AppError(
        "Chỉ có thể giao việc cho người dùng đang active",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 5. Cross-team check for non-admin assigners
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(assignedBy),
    );
    const hasApprovePerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    const isDirectMentor = targetUser.internshipProfile?.mentorId === assignedBy;
    const isCrossTeam = !isDirectMentor && assignedBy !== targetUser.id;
    if (!hasApprovePerm && isCrossTeam) {
      const confirmedEmail = data.internEmail?.toLowerCase().trim();
      if (!confirmedEmail || confirmedEmail !== targetUser.email?.toLowerCase().trim()) {
        throw new AppError(
          "Email người dùng là bắt buộc và phải khớp khi giao việc cho team khác",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // 6. Check existing assignment
    const existing = await this.repository.findByTaskId(data.taskId);
    if (existing) {
      throw new AppError(
        "Task has already been assigned",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    // 7. Check Capacity
    await this.ensureAssigneeCapacity(assigneeUserId, task, "OWNER");

    if (supportUserId) {
      const supportUser = await this.repository.findUserById(supportUserId);
      if (!supportUser) {
        throw new AppError("Support User not found", 404, ERROR_CODE.NOT_FOUND);
      }
      if (!supportUser.isActive) {
        throw new AppError("Support User is not active", 400, ERROR_CODE.VALIDATION_ERROR);
      }
      await this.ensureAssigneeCapacity(supportUserId, task, "SUPPORT");
    }

    // 8. Determine status
    let status: AssignmentStatus = ASSIGNMENT_STATUS.TODO;
    if (!hasApprovePerm && isCrossTeam) {
      status = ASSIGNMENT_STATUS.PENDING_APPROVAL;
    }

    const assignmentData: CreateTaskAssignmentDto = {
      taskId: data.taskId,
      assigneeId: assigneeUserId,
      internId: assigneeUserId,
      supportId: supportUserId,
    };

    const result = await this.repository.create(assignmentData, assignedBy, status);

    // 9. Dispatch notification if auto-approved (TODO)
    if (status === ASSIGNMENT_STATUS.TODO && targetUser.email) {
      try {
        await notificationDispatcher.send({
          channels: [NOTIFICATION_CHANNEL.WEB],
          userId: targetUser.id,
          web: {
            type: NOTIFICATION_TYPE.INFO,
            title: "Công việc mới được phân công",
            content: `Bạn đã được phân công công việc "${task.title}". Hạn chót: ${task.deadline ? new Date(task.deadline).toLocaleDateString("vi-VN") : "Chưa thiết lập"}`,
          },
        });
      } catch (e) {
        console.warn("[TaskAssignmentService] Notification dispatch skipped:", e);
      }
    }

    await this.repository.createAuditLog({
      actorId: assignedBy,
      action: AUDIT_ACTION.ASSIGN_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: result.id,
      details: {
        taskId: task.id,
        assigneeId: assigneeUserId,
        status,
        isCrossTeam,
      },
      ipAddress: context?.ipAddress,
    });

    // Discord Webhook
    try {
      await discordWebhookService.notifyTaskCreated({
        taskGroupId: task.taskGroupId,
        departmentId: task.taskGroup?.departmentId || targetUser.internshipProfile?.departmentId,
        task: {
          id: task.id,
          code: task.code,
          title: task.title,
          deadline: task.deadline,
          priority: task.priority,
          assigneeName: targetUser.fullName || targetUser.email || "Thực tập sinh",
          assigneeDiscordId: targetUser.discordUsername,
        },
      });
    } catch (err: any) {
      console.warn("[TaskAssignmentService] Failed to dispatch Discord task created:", err.message);
    }

    return result;
  }

  async assignTask(
    taskId: string,
    data: AssignTaskDto,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const existing = await this.repository.findByTaskId(taskId);
    if (existing) {
      return this.update(existing.id, data, actorId, actorRole, context);
    }
    return this.create({ taskId, ...data }, actorId, actorRole, context);
  }

  async unassignTask(
    taskId: string,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.repository.findByTaskId(taskId);
    if (!assignment) {
      throw new AppError("Task assignment not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return this.delete(assignment.id, actorId, actorRole, context);
  }

  async approve(
    id: string,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    if (assignment.status !== ASSIGNMENT_STATUS.PENDING_APPROVAL) {
      throw new AppError(
        "Yêu cầu giao việc không ở trạng thái chờ duyệt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const isGlobalAdmin =
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_READ);
    const hasApprovePerm = callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE);

    const isAuthorized = await this.isManagerOrMentor(
      actorId,
      assignment.assigneeId,
      assignment.task?.taskGroup?.departmentId,
    );

    if (!isGlobalAdmin && (!isAuthorized || !hasApprovePerm)) {
      throw new AppError(
        "Bạn không có quyền duyệt yêu cầu giao việc này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    if (assignment.assigneeId && assignment.task) {
      await this.ensureAssigneeCapacity(
        assignment.assigneeId,
        assignment.task,
        "OWNER",
        assignment.id,
      );
    }

    const result = await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.TODO,
    });

    if (assignment.assignee?.email) {
      try {
        await notificationDispatcher.send({
          channels: [NOTIFICATION_CHANNEL.WEB],
          userId: assignment.assignee.id,
          web: {
            type: NOTIFICATION_TYPE.INFO,
            title: "Yêu cầu giao việc đã được duyệt",
            content: `Yêu cầu giao việc "${assignment.task?.title}" đã được phê duyệt.`,
          },
        });
      } catch (e) {
        console.warn("[TaskAssignmentService] Notification dispatch skipped:", e);
      }
    }

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.APPROVE_TASK_ASSIGNMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: { taskId: assignment.taskId, assigneeId: assignment.assigneeId },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async reject(
    id: string,
    reason: string | undefined,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    if (assignment.status !== ASSIGNMENT_STATUS.PENDING_APPROVAL) {
      throw new AppError(
        "Yêu cầu giao việc không ở trạng thái chờ duyệt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const isGlobalAdmin =
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_READ);
    const hasApprovePerm = callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE);

    const isAuthorized = await this.isManagerOrMentor(
      actorId,
      assignment.assigneeId,
      assignment.task?.taskGroup?.departmentId,
    );

    if (!isGlobalAdmin && (!isAuthorized || !hasApprovePerm)) {
      throw new AppError(
        "Bạn không có quyền từ chối yêu cầu giao việc này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const rejectionReason =
      reason || "Yêu cầu giao việc xuyên team đã bị từ chối.";

    const result = await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.BLOCKED,
      blockedReason: rejectionReason,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.REJECT_TASK_ASSIGNMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: {
        taskId: assignment.taskId,
        assigneeId: assignment.assigneeId,
        reason: rejectionReason,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async update(
    id: string,
    data: UpdateTaskAssignmentDto,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    this.ensureAssignmentEditable(assignment.status);

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const hasGlobalUpdateAccess =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    const isOwnAssignment = assignment.assigneeId === actorId || assignment.internId === actorId;
    if (isOwnAssignment) {
      const canStartOwn =
        data.status === ASSIGNMENT_STATUS.IN_PROGRESS &&
        assignment.status === ASSIGNMENT_STATUS.TODO &&
        data.assigneeId === undefined &&
        data.internId === undefined &&
        data.supportId === undefined;
      const canBlockOwn =
        data.status === ASSIGNMENT_STATUS.BLOCKED &&
        assignment.status === ASSIGNMENT_STATUS.IN_PROGRESS &&
        data.blockedReason !== undefined &&
        data.assigneeId === undefined &&
        data.internId === undefined &&
        data.supportId === undefined;

      if (!canStartOwn && !canBlockOwn && !hasGlobalUpdateAccess) {
        throw new AppError(
          "Intern can only start their own TODO assignment or block their own IN_PROGRESS assignment",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    } else if (
      !hasGlobalUpdateAccess &&
      assignment.assignedBy !== actorId
    ) {
      const isAuthorized = await this.isManagerOrMentor(
        actorId,
        assignment.assigneeId,
        assignment.task?.taskGroup?.departmentId,
      );
      if (!isAuthorized) {
        throw new AppError(
          "Bạn không có quyền cập nhật phân công này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    const resolvedAssigneeId = await this.resolveAssigneeUserId(data.assigneeId || data.internId);
    const resolvedSupportId = await this.resolveAssigneeUserId(data.supportId);

    // Reassigning assignee check
    if (resolvedAssigneeId !== undefined && resolvedAssigneeId !== assignment.assigneeId) {
      const newAssignee = await this.repository.findUserById(resolvedAssigneeId);
      if (!newAssignee) {
        throw new AppError("User not found", 404, ERROR_CODE.NOT_FOUND);
      }
      if (!newAssignee.isActive) {
        throw new AppError(
          "Chỉ có thể giao việc cho người dùng đang active",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      if (assignment.task?.taskGroupId) {
        await this.validateTaskGroupMembership(assignment.task.taskGroupId, resolvedAssigneeId);
      }

      const isCrossTeam = newAssignee.internshipProfile?.mentorId !== actorId && actorId !== resolvedAssigneeId;
      const hasApprovePerm =
        callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);
      if (!hasApprovePerm && isCrossTeam) {
        const confirmedEmail = data.internEmail?.toLowerCase().trim();
        if (!confirmedEmail || confirmedEmail !== newAssignee.email?.toLowerCase().trim()) {
          throw new AppError(
            "Email người dùng là bắt buộc và phải khớp khi giao việc cho team khác",
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
        data.status = ASSIGNMENT_STATUS.PENDING_APPROVAL;
      } else {
        data.status = ASSIGNMENT_STATUS.TODO;
      }

      if (assignment.task) {
        await this.ensureAssigneeCapacity(
          resolvedAssigneeId,
          assignment.task,
          "OWNER",
          assignment.id,
        );
      }
    }

    // Support user check
    if (resolvedSupportId !== undefined && resolvedSupportId !== assignment.supportId) {
      if (resolvedSupportId) {
        const supportUser = await this.repository.findUserById(resolvedSupportId);
        if (!supportUser) {
          throw new AppError("Support User not found", 404, ERROR_CODE.NOT_FOUND);
        }
        if (!supportUser.isActive) {
          throw new AppError("Support User is not active", 400, ERROR_CODE.VALIDATION_ERROR);
        }

        if (assignment.task?.taskGroupId) {
          await this.validateTaskGroupMembership(assignment.task.taskGroupId, resolvedSupportId);
        }

        if (assignment.task) {
          await this.ensureAssigneeCapacity(
            resolvedSupportId,
            assignment.task,
            "SUPPORT",
            assignment.id,
          );
        }
      }
    }

    const updatePayload: UpdateTaskAssignmentDto = {
      ...data,
      assigneeId: resolvedAssigneeId,
      internId: resolvedAssigneeId,
      supportId: resolvedSupportId,
    };

    const result = await this.repository.update(id, updatePayload);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_TASK_ASSIGNMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: {
        taskId: assignment.taskId,
        updatedFields: Object.keys(data),
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async delete(
    id: string,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    this.ensureAssignmentEditable(assignment.status);

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const hasGlobalDeleteAccess =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!hasGlobalDeleteAccess && assignment.assignedBy !== actorId) {
      const isAuthorized = await this.isManagerOrMentor(
        actorId,
        assignment.assigneeId,
        assignment.task?.taskGroup?.departmentId,
      );
      if (!isAuthorized) {
        throw new AppError(
          "Bạn không có quyền hủy phân công công việc này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_TASK_ASSIGNMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: { taskId: assignment.taskId, assigneeId: assignment.assigneeId },
      ipAddress: context?.ipAddress,
    });

    return { message: "Task assignment removed successfully" };
  }

  async startTask(
    id: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    this.ensureAssignmentEditable(assignment.status);

    if (assignment.status !== ASSIGNMENT_STATUS.TODO) {
      throw new AppError(
        "Chỉ công việc ở trạng thái Cần làm (TODO) mới có thể bắt đầu làm",
        400,
        ERROR_CODE.INVALID_STATUS_TRANSITION,
      );
    }

    const isOwner = assignment.assigneeId === actor.id || assignment.internId === actor.id;
    const isSupport = assignment.supportId === actor.id;
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const hasGlobalAccess =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!isOwner && !isSupport && !hasGlobalAccess) {
      throw new AppError(
        "Bạn chỉ có thể bắt đầu công việc được phân công cho mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const taskWithPrereqs = await this.taskRepository.findWithPrerequisites(
      assignment.taskId,
    );

    if (taskWithPrereqs && taskWithPrereqs.dependsOn.length > 0) {
      const unfinishedPrereqs = taskWithPrereqs.dependsOn.filter(
        (p) => p.assignment?.status !== ASSIGNMENT_STATUS.DONE,
      );
      if (unfinishedPrereqs.length > 0) {
        const prereqCodes = unfinishedPrereqs
          .map((p) => p.code || p.title)
          .join(", ");
        throw new AppError(
          `Không thể bắt đầu làm việc vì các task điều kiện tiên quyết chưa hoàn thành: ${prereqCodes}`,
          400,
          ERROR_CODE.INVALID_STATUS_TRANSITION,
        );
      }
    }

    const now = new Date();
    const result = await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.IN_PROGRESS,
      startedAt: now,
    });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.START_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: { taskId: assignment.taskId, status: ASSIGNMENT_STATUS.IN_PROGRESS },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async blockTask(
    id: string,
    actor: UserPayload,
    blockedReason: string,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    this.ensureAssignmentEditable(assignment.status);

    if (assignment.status !== ASSIGNMENT_STATUS.IN_PROGRESS) {
      throw new AppError(
        "Chỉ công việc đang thực hiện (IN_PROGRESS) mới có thể báo bị chặn",
        400,
        ERROR_CODE.INVALID_STATUS_TRANSITION,
      );
    }

    if (!blockedReason || !blockedReason.trim()) {
      throw new AppError(
        "Lý do bị chặn là bắt buộc",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const isOwner = assignment.assigneeId === actor.id || assignment.internId === actor.id;
    const isSupport = assignment.supportId === actor.id;
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const hasGlobalAccess =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!isOwner && !isSupport && !hasGlobalAccess) {
      throw new AppError(
        "Bạn chỉ có thể báo bị chặn cho công việc được phân công cho mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.BLOCKED,
      blockedReason: blockedReason.trim(),
    });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.BLOCK_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: {
        taskId: assignment.taskId,
        blockedReason: blockedReason.trim(),
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async unblockTask(
    id: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    this.ensureAssignmentEditable(assignment.status);

    if (assignment.status !== ASSIGNMENT_STATUS.BLOCKED) {
      throw new AppError(
        "Chỉ công việc đang bị chặn (BLOCKED) mới có thể bỏ chặn",
        400,
        ERROR_CODE.INVALID_STATUS_TRANSITION,
      );
    }

    const isOwner = assignment.assigneeId === actor.id || assignment.internId === actor.id;
    const isSupport = assignment.supportId === actor.id;
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const hasGlobalAccess =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!isOwner && !isSupport && !hasGlobalAccess) {
      throw new AppError(
        "Bạn chỉ có thể bỏ chặn cho công việc được phân công cho mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.IN_PROGRESS,
      blockedReason: null,
    });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.UNBLOCK_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: {
        taskId: assignment.taskId,
        previousBlockedReason: assignment.blockedReason,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async requestExtension(
    id: string,
    actor: UserPayload,
    dto: RequestTaskExtensionDto,
    context?: { ipAddress?: string },
  ) {
    const assignment = await this.findById(id);

    this.ensureAssignmentEditable(assignment.status);

    if (assignment.status === ASSIGNMENT_STATUS.DONE) {
      throw new AppError(
        "Không thể xin gia hạn cho công việc đã hoàn thành",
        400,
        ERROR_CODE.TASK_ALREADY_COMPLETED,
      );
    }

    const isOwner = assignment.assigneeId === actor.id || assignment.internId === actor.id;
    const isSupport = assignment.supportId === actor.id;
    if (!isOwner && !isSupport) {
      throw new AppError(
        "Bạn chỉ có thể xin gia hạn cho công việc được phân công cho mình",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const task = await this.repository.findTaskById(assignment.taskId);
    if (!task) {
      throw new AppError("Công việc không tồn tại", 404, ERROR_CODE.NOT_FOUND);
    }

    const existingPending =
      await this.repository.findPendingExtensionRequestByAssignmentId(id);
    if (existingPending) {
      throw new AppError(
        "Công việc này đang có một đề xuất xin gia hạn chờ Leader xét duyệt",
        400,
        ERROR_CODE.EXTENSION_ALREADY_PENDING,
      );
    }

    const proposedDate = new Date(dto.proposedDeadline);
    if (isNaN(proposedDate.getTime())) {
      throw new AppError(
        "Ngày deadline mới không hợp lệ",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (!task.deadline) {
      throw new AppError(
        "Công việc chưa có hạn chót, không thể tạo yêu cầu gia hạn",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const currentDeadline = new Date(task.deadline);
    if (proposedDate.getTime() <= currentDeadline.getTime()) {
      throw new AppError(
        "Ngày deadline mới đề xuất phải sau ngày deadline hiện tại của task",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const targetUserId = assignment.assigneeId || actor.id;

    const extensionRequest = await this.repository.createExtensionRequest({
      assignmentId: id,
      userId: targetUserId,
      currentDeadline,
      proposedDeadline: proposedDate,
      extensionDays: dto.extensionDays,
      reason: dto.reason.trim(),
      commitmentPlan: dto.commitmentPlan.trim(),
    });

    await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.EXTENSION_PENDING,
    });

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.REQUEST_TASK_EXTENSION,
      targetType: AUDIT_TARGET_TYPE.TASK_EXTENSION_REQUEST,
      targetId: extensionRequest.id,
      details: {
        taskId: assignment.taskId,
        assignmentId: id,
        currentDeadline: currentDeadline.toISOString(),
        proposedDeadline: proposedDate.toISOString(),
        extensionDays: dto.extensionDays,
        reason: dto.reason.trim(),
      },
      ipAddress: context?.ipAddress,
    });

    // Discord Webhook
    try {
      const taskDetail = await this.taskRepository.findById(assignment.taskId);
      const userDetail = await this.repository.findUserById(targetUserId);

      await discordWebhookService.notifyTaskExtensionRequested({
        departmentId: taskDetail?.taskGroup?.departmentId,
        taskGroupId: taskDetail?.taskGroupId,
        requestId: extensionRequest.id,
        task: {
          id: assignment.taskId,
          code: taskDetail?.code,
          title: taskDetail?.title || "Nhiệm vụ",
          internName: userDetail?.fullName || userDetail?.email || "Thực tập sinh",
          extensionDays: dto.extensionDays,
          proposedDeadline: proposedDate,
          reason: dto.reason.trim(),
          commitmentPlan: dto.commitmentPlan?.trim(),
          leaderDiscordId: userDetail?.internshipProfile?.mentor?.discordUserId,
          leaderName: userDetail?.internshipProfile?.mentor?.fullName || undefined,
        },
      });
    } catch (err: any) {
      console.warn("[TaskAssignmentService] Failed to dispatch Discord task extension request:", err.message);
    }

    const [totalExtensionsOnTask, totalExtensionsInInternship] =
      await Promise.all([
        this.repository.countExtensionsOnTask(id),
        this.repository.countExtensionsByUserId(targetUserId),
      ]);

    return {
      ...extensionRequest,
      totalExtensionsOnTask,
      totalExtensionsInInternship,
    };
  }

  async getExtensionRequests(
    query: QueryExtensionRequestsDto,
    actor: UserPayload,
  ) {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const hasAdminPerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    let scope: { userId?: string; departmentIds?: string[]; leaderUserId?: string } | undefined;

    if (!hasAdminPerm) {
      const managedDeptIds = await this.repository.findManagedDepartmentIds(actor.id);
      if (managedDeptIds.length > 0) {
        scope = {
          departmentIds: managedDeptIds,
          leaderUserId: actor.id,
        };
      } else {
        scope = { userId: actor.id };
      }
    }

    const result = await this.repository.findExtensionRequests(query, scope);

    const enrichedItems = await Promise.all(
      result.data.map(async (item) => {
        const [totalExtensionsOnTask, totalExtensionsInInternship] =
          await Promise.all([
            this.repository.countExtensionsOnTask(item.assignmentId),
            this.repository.countExtensionsByUserId(item.userId || item.internId || ""),
          ]);
        return {
          ...item,
          totalExtensionsOnTask,
          totalExtensionsInInternship,
        };
      }),
    );

    return {
      items: enrichedItems,
      meta: result.meta,
    };
  }

  async getExtensionRequestsByAssignment(
    assignmentId: string,
    actor: UserPayload,
  ) {
    return this.getExtensionRequests({ assignmentId } as QueryExtensionRequestsDto, actor);
  }

  async approveExtension(
    requestId: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const request = await this.repository.findExtensionRequestById(requestId);
    if (!request) {
      throw new AppError(
        "Yêu cầu gia hạn không tồn tại",
        404,
        ERROR_CODE.EXTENSION_REQUEST_NOT_FOUND,
      );
    }

    if (request.status !== EXTENSION_REQUEST_STATUS.PENDING) {
      throw new AppError(
        "Yêu cầu gia hạn này đã được xử lý trước đó",
        400,
        ERROR_CODE.INVALID_STATUS_TRANSITION,
      );
    }

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const isGlobalAdmin =
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_READ);
    const hasApprovePerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.TASK_UPDATE);

    const isAuthorized = await this.isManagerOrMentor(
      actor.id,
      request.userId,
    );

    if (!isGlobalAdmin && (!isAuthorized || !hasApprovePerm)) {
      throw new AppError(
        "Chỉ Leader trực tiếp hoặc Quản trị viên mới có quyền xét duyệt gia hạn",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    return this.repository.approveExtensionInTransaction({
      requestId,
      assignmentId: request.assignmentId,
      taskId: request.assignment.taskId,
      proposedDeadline: request.proposedDeadline,
      actorId: actor.id,
      oldDeadline: request.currentDeadline,
      extensionDays: request.extensionDays,
      ipAddress: context?.ipAddress,
    });
  }

  async rejectExtension(
    requestId: string,
    actor: UserPayload,
    rejectionReason: string,
    context?: { ipAddress?: string },
  ) {
    const request = await this.repository.findExtensionRequestById(requestId);
    if (!request) {
      throw new AppError(
        "Yêu cầu gia hạn không tồn tại",
        404,
        ERROR_CODE.EXTENSION_REQUEST_NOT_FOUND,
      );
    }

    if (request.status !== EXTENSION_REQUEST_STATUS.PENDING) {
      throw new AppError(
        "Yêu cầu gia hạn này đã được xử lý trước đó",
        400,
        ERROR_CODE.INVALID_STATUS_TRANSITION,
      );
    }

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const isGlobalAdmin =
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN) ||
      callerPerms.has(PERMISSIONS.ROLE_READ);
    const hasApprovePerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.TASK_UPDATE);

    const isAuthorized = await this.isManagerOrMentor(
      actor.id,
      request.userId,
    );

    if (!isGlobalAdmin && (!isAuthorized || !hasApprovePerm)) {
      throw new AppError(
        "Chỉ Leader trực tiếp hoặc Quản trị viên mới có quyền từ chối gia hạn",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    return this.repository.rejectExtensionInTransaction({
      requestId,
      assignmentId: request.assignmentId,
      taskId: request.assignment.taskId,
      reason: rejectionReason.trim(),
      actorId: actor.id,
      ipAddress: context?.ipAddress,
    });
  }
}

export const taskAssignmentService = new TaskAssignmentService();
