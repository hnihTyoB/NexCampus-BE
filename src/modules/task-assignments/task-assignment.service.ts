import { TaskAssignmentRepository } from "./task-assignment.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  AssignTaskDto,
  UpdateTaskAssignmentDto,
} from "./task-assignment.dto";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import {
  ASSIGNMENT_STATUS,
  ACTIVE_CAPACITY_STATUSES,
  SUPPORT_WORKLOAD_FACTOR,
  DEFAULT_MAX_WORKLOAD_DAYS,
  DEFAULT_TASK_DAYS,
} from "../../common/constants/task.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { AssignmentStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
} from "../../common/constants/notification.constant";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class TaskAssignmentService {
  private readonly repository = new TaskAssignmentRepository();

  private ensureAssignmentEditable(status: AssignmentStatus) {
    if (status === ASSIGNMENT_STATUS.DONE) {
      throw new AppError(
        "Completed tasks cannot be edited",
        409,
        ERROR_CODE.TASK_ALREADY_COMPLETED,
      );
    }
  }

  private async ensureInternCapacity(
    internId: string,
    task: { id: string; title: string; estDays: number | null },
    role: "OWNER" | "SUPPORT" = "OWNER",
    excludeAssignmentId?: string,
  ) {
    const [taskWithLimits, activeAssignments] = await Promise.all([
      prisma.task.findFirst({
        where: { id: task.id, deletedAt: null },
        select: {
          taskGroup: {
            select: { maxWorkloadDays: true, maxActiveTasks: true },
          },
        },
      }),
      prisma.taskAssignment.findMany({
        where: {
          ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
          status: { in: [...ACTIVE_CAPACITY_STATUSES] },
          task: { deletedAt: null },
          OR: [{ internId }, { supportId: internId }],
        },
        select: {
          internId: true,
          supportId: true,
          task: { select: { estDays: true } },
        },
      }),
    ]);

    const maxWorkloadDays =
      taskWithLimits?.taskGroup?.maxWorkloadDays ?? DEFAULT_MAX_WORKLOAD_DAYS;
    const maxActiveTasks = taskWithLimits?.taskGroup?.maxActiveTasks ?? 5;

    const currentWorkloadDays = activeAssignments.reduce((total, assignment) => {
      const days = assignment.task.estDays ?? DEFAULT_TASK_DAYS;
      return (
        total +
        (assignment.internId === internId
          ? days
          : days * SUPPORT_WORKLOAD_FACTOR)
      );
    }, 0);

    const factor = role === "OWNER" ? 1 : SUPPORT_WORKLOAD_FACTOR;
    const taskDays = (task.estDays ?? DEFAULT_TASK_DAYS) * factor;
    const nextWorkloadDays = currentWorkloadDays + taskDays;
    const nextActiveTaskCount = activeAssignments.length + 1;

    if (nextWorkloadDays > maxWorkloadDays) {
      throw new AppError(
        `Không thể giao task "${task.title}": TTS sẽ vượt giới hạn workload (${currentWorkloadDays}/${maxWorkloadDays} ngày hiện tại, task cần ${taskDays} ngày)`,
        409,
        ERROR_CODE.CONFLICT,
      );
    }

    if (nextActiveTaskCount > maxActiveTasks) {
      throw new AppError(
        `Không thể giao task "${task.title}": TTS đã đạt tối đa ${maxActiveTasks} task active`,
        409,
        ERROR_CODE.CONFLICT,
      );
    }
  }

  private async validateTaskGroupMembership(taskGroupId: string, internId: string) {
    const membership = await prisma.taskGroupMember.findUnique({
      where: {
        taskGroupId_internId: {
          taskGroupId,
          internId,
        },
      },
    });

    if (!membership) {
      throw new AppError(
        "Thực tập sinh được phân công phải thuộc danh sách thành viên của Task Group",
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
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

      if (!hasGlobalAccess) {
        const intern = await prisma.intern.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (intern) {
          return this.repository.findAll(query, { internId: intern.id });
        }

        const leader = await prisma.leader.findFirst({
          where: { userId: user.id },
          select: { departments: { select: { departmentId: true } } },
        });
        if (leader) {
          const departmentIds =
            leader.departments.map((d) => d.departmentId) ?? [];
          return this.repository.findAll(query, {
            departmentIds,
            leaderUserId: user.id,
          });
        }
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
      const callerPerms = new Set(
        await permissionCacheService.getUserPermissions(user.id),
      );
      const hasGlobalAccess =
        callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

      if (!hasGlobalAccess) {
        const intern = await prisma.intern.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (intern) {
          const isOwner = assignment.internId === intern.id;
          const isSupport = assignment.supportId === intern.id;
          if (!isOwner && !isSupport) {
            throw new AppError(
              "You are not authorized to view this assignment",
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
        } else {
          const isAssigner = assignment.assignedBy === user.id;
          const isLeader = assignment.intern?.leaderId === user.id;
          if (!isAssigner && !isLeader) {
            throw new AppError(
              "You are not authorized to view this assignment",
              403,
              ERROR_CODE.FORBIDDEN,
            );
          }
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
    // 1. Check Task exists and not soft-deleted
    const task = await prisma.task.findFirst({
      where: { id: data.taskId, deletedAt: null },
      include: {
        taskGroup: { select: { id: true, departmentId: true } },
      },
    });
    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Check Task Deadline
    const deadlineDay = new Date(task.deadline);
    deadlineDay.setHours(23, 59, 59, 999);
    if (deadlineDay.getTime() < Date.now()) {
      throw new AppError(
        "Task past deadline cannot be assigned",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Check Task Group Membership if task belongs to a task group
    if (task.taskGroupId) {
      await this.validateTaskGroupMembership(task.taskGroupId, data.internId);
      if (data.supportId) {
        await this.validateTaskGroupMembership(task.taskGroupId, data.supportId);
      }
    }

    // 4. Check Intern profile
    const intern = await prisma.intern.findUnique({
      where: { id: data.internId },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });
    if (!intern || intern.deletedAt) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (intern.status !== "ACTIVE" || !intern.user.isActive) {
      throw new AppError(
        "Chỉ có thể giao việc cho thực tập sinh đang active",
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

    const isCrossTeam = intern.leaderId !== assignedBy;
    if (!hasApprovePerm && isCrossTeam) {
      const confirmedEmail = data.internEmail?.toLowerCase().trim();
      if (!confirmedEmail || confirmedEmail !== intern.user.email?.toLowerCase().trim()) {
        throw new AppError(
          "Email thực tập sinh là bắt buộc và phải khớp khi giao việc cho team khác",
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
    await this.ensureInternCapacity(data.internId, task, "OWNER");

    if (data.supportId) {
      const supportIntern = await prisma.intern.findUnique({
        where: { id: data.supportId },
        include: { user: { select: { id: true, isActive: true } } },
      });
      if (!supportIntern || supportIntern.deletedAt) {
        throw new AppError("Support Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
      }
      if (supportIntern.status !== "ACTIVE" || !supportIntern.user.isActive) {
        throw new AppError("Support Intern is not active", 400, ERROR_CODE.VALIDATION_ERROR);
      }
      await this.ensureInternCapacity(data.supportId, task, "SUPPORT");
    }

    // 8. Determine status
    let status: AssignmentStatus = ASSIGNMENT_STATUS.TODO;
    if (!hasApprovePerm && isCrossTeam) {
      status = ASSIGNMENT_STATUS.PENDING_APPROVAL;
    }

    const result = await this.repository.create(data, assignedBy, status);

    // 9. Dispatch notification if auto-approved (TODO)
    if (status === ASSIGNMENT_STATUS.TODO && intern.user.email) {
      try {
        await notificationDispatcher.send({
          channels: [NOTIFICATION_CHANNEL.WEB],
          userId: intern.userId,
          web: {
            type: NOTIFICATION_TYPE.INFO,
            title: "Công việc mới được phân công",
            content: `Bạn đã được phân công công việc "${task.title}". Hạn chót: ${new Date(task.deadline).toLocaleDateString("vi-VN")}`,
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
        internId: intern.id,
        status,
        isCrossTeam,
      },
      ipAddress: context?.ipAddress,
    });

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

    if (!assignment.intern) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (assignment.status !== ASSIGNMENT_STATUS.PENDING_APPROVAL) {
      throw new AppError(
        "Yêu cầu giao việc không ở trạng thái chờ duyệt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Only Admin or the direct Leader of the intern is allowed to approve
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const hasApprovePerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!hasApprovePerm && assignment.intern.leaderId !== actorId) {
      throw new AppError(
        "Bạn không có quyền duyệt yêu cầu giao việc này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    await this.ensureInternCapacity(
      assignment.intern.id,
      assignment.task,
      "OWNER",
      assignment.id,
    );

    const result = await this.repository.update(id, {
      status: ASSIGNMENT_STATUS.TODO,
    });

    if (assignment.intern.user?.email) {
      try {
        await notificationDispatcher.send({
          channels: [NOTIFICATION_CHANNEL.WEB],
          userId: assignment.intern.userId,
          web: {
            type: NOTIFICATION_TYPE.INFO,
            title: "Yêu cầu giao việc đã được duyệt",
            content: `Yêu cầu giao việc "${assignment.task.title}" đã được Leader phê duyệt.`,
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
      details: { taskId: assignment.taskId, internId: assignment.internId },
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

    if (!assignment.intern) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (assignment.status !== ASSIGNMENT_STATUS.PENDING_APPROVAL) {
      throw new AppError(
        "Yêu cầu giao việc không ở trạng thái chờ duyệt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Only Admin or direct Leader can reject
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const hasApprovePerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!hasApprovePerm && assignment.intern.leaderId !== actorId) {
      throw new AppError(
        "Bạn không có quyền từ chối yêu cầu giao việc này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const rejectionReason =
      reason || "Yêu cầu giao việc xuyên team đã bị Leader từ chối.";

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
        internId: assignment.internId,
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

    // Lock check: DONE assignments cannot be modified!
    this.ensureAssignmentEditable(assignment.status);

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const hasGlobalUpdateAccess =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    const isOwnAssignment = assignment.intern?.userId === actorId;
    if (isOwnAssignment) {
      const canStartOwn =
        data.status === ASSIGNMENT_STATUS.IN_PROGRESS &&
        assignment.status === ASSIGNMENT_STATUS.TODO &&
        data.internId === undefined &&
        data.supportId === undefined;
      const canBlockOwn =
        data.status === ASSIGNMENT_STATUS.BLOCKED &&
        assignment.status === ASSIGNMENT_STATUS.IN_PROGRESS &&
        data.blockedReason !== undefined &&
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
      (assignment.intern
        ? assignment.intern.leaderId !== actorId && assignment.assignedBy !== actorId
        : assignment.assignedBy !== actorId)
    ) {
      throw new AppError(
        "Bạn không có quyền cập nhật phân công này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // Reassigning intern check
    if (data.internId !== undefined && data.internId !== assignment.internId) {
      const newIntern = await prisma.intern.findUnique({
        where: { id: data.internId },
        include: { user: { select: { id: true, email: true, isActive: true } } },
      });
      if (!newIntern || newIntern.deletedAt) {
        throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
      }
      if (newIntern.status !== "ACTIVE" || !newIntern.user.isActive) {
        throw new AppError(
          "Chỉ có thể giao việc cho thực tập sinh đang active",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      if (assignment.task.taskGroupId) {
        await this.validateTaskGroupMembership(assignment.task.taskGroupId, data.internId);
      }

      const isCrossTeam = newIntern.leaderId !== actorId;
      const hasApprovePerm =
        callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
        callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);
      if (!hasApprovePerm && isCrossTeam) {
        const confirmedEmail = data.internEmail?.toLowerCase().trim();
        if (!confirmedEmail || confirmedEmail !== newIntern.user.email?.toLowerCase().trim()) {
          throw new AppError(
            "Email thực tập sinh là bắt buộc và phải khớp khi giao việc cho team khác",
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
        data.status = ASSIGNMENT_STATUS.PENDING_APPROVAL;
      } else {
        data.status = ASSIGNMENT_STATUS.TODO;
      }

      await this.ensureInternCapacity(
        data.internId,
        assignment.task,
        "OWNER",
        assignment.id,
      );
    }

    // Support intern check
    if (data.supportId !== undefined && data.supportId !== assignment.supportId) {
      if (data.supportId) {
        const supportIntern = await prisma.intern.findUnique({
          where: { id: data.supportId },
          include: { user: { select: { id: true, isActive: true } } },
        });
        if (!supportIntern || supportIntern.deletedAt) {
          throw new AppError("Support Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
        }
        if (supportIntern.status !== "ACTIVE" || !supportIntern.user.isActive) {
          throw new AppError("Support Intern is not active", 400, ERROR_CODE.VALIDATION_ERROR);
        }

        if (assignment.task.taskGroupId) {
          await this.validateTaskGroupMembership(assignment.task.taskGroupId, data.supportId);
        }

        await this.ensureInternCapacity(
          data.supportId,
          assignment.task,
          "SUPPORT",
          assignment.id,
        );
      }
    }

    const result = await this.repository.update(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_TASK_ASSIGNMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: {
        status: data.status,
        internId: data.internId,
        supportId: data.supportId,
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

    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    const hasDeletePerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    const isDirectLeader = assignment.intern?.leaderId === actorId;
    const isAssignmentRequester = assignment.assignedBy === actorId;
    if (
      !hasDeletePerm &&
      !isDirectLeader &&
      !isAssignmentRequester
    ) {
      throw new AppError(
        "Bạn không có quyền hủy phân công này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // Lock check: DONE assignments cannot be deleted / unassigned!
    this.ensureAssignmentEditable(assignment.status);

    const result = await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_TASK_ASSIGNMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ASSIGNMENT,
      targetId: id,
      details: { taskId: assignment.taskId, internId: assignment.internId },
      ipAddress: context?.ipAddress,
    });

    return result;
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

    const intern = await prisma.intern.findUnique({
      where: { userId: actor.id },
    });
    if (intern) {
      const isOwner = assignment.internId === intern.id;
      const isSupport = assignment.supportId === intern.id;
      if (!isOwner && !isSupport) {
        throw new AppError(
          "Bạn chỉ có thể bắt đầu công việc được phân công cho mình",
          403,
          ERROR_CODE.FORBIDDEN,
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

    // Ràng buộc bền vững: Intern chỉ báo blocked khi IN_PROGRESS
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

    const intern = await prisma.intern.findUnique({
      where: { userId: actor.id },
    });
    if (intern) {
      const isOwner = assignment.internId === intern.id;
      const isSupport = assignment.supportId === intern.id;
      if (!isOwner && !isSupport) {
        throw new AppError(
          "Bạn chỉ có thể báo bị chặn cho công việc được phân công cho mình",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
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
      details: { taskId: assignment.taskId, blockedReason: blockedReason.trim() },
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
        "Chỉ công việc đang bị chặn (BLOCKED) mới có thể mở lại",
        400,
        ERROR_CODE.INVALID_STATUS_TRANSITION,
      );
    }

    // Ràng buộc bền vững: Chỉ Leader trực tiếp hoặc Admin mới có quyền thao tác (Intern không được tự mở)
    const isDirectLeader = assignment.intern?.leaderId === actor.id;
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actor.id),
    );
    const hasAdminPerm =
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_DELETE) ||
      callerPerms.has(PERMISSIONS.TASK_ASSIGNMENT_APPROVE) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN);

    if (!hasAdminPerm && !isDirectLeader) {
      throw new AppError(
        "Chỉ Leader trực tiếp hoặc Admin mới có quyền mở lại task bị chặn",
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
      details: { taskId: assignment.taskId, status: ASSIGNMENT_STATUS.IN_PROGRESS },
      ipAddress: context?.ipAddress,
    });

    return result;
  }
}
