import { TaskAssignmentRepository } from "./task-assignment.repository";
import { TaskRepository } from "../tasks/task.repository";
import { InternRepository } from "../interns/intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  AssignTaskDto,
  UpdateTaskAssignmentDto,
} from "./task-assignment.dto";
import { ROLES } from "../../common/constants/role.constant";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { AssignmentStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";

const ACTIVE_CAPACITY_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.PENDING_APPROVAL,
  AssignmentStatus.TODO,
  AssignmentStatus.IN_PROGRESS,
  AssignmentStatus.REVIEW,
];
const DEFAULT_MAX_WORKLOAD_DAYS = 10;
const DEFAULT_TASK_DAYS = 3;
const SUPPORT_WORKLOAD_FACTOR = 0.5;

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class TaskAssignmentService {
  private readonly repository = new TaskAssignmentRepository();
  private readonly taskRepository = new TaskRepository();
  private readonly internRepository = new InternRepository();
  private readonly activityLogService = new ActivityLogService();

  private ensureAssignmentEditable(status: AssignmentStatus) {
    if (status === AssignmentStatus.DONE) {
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
          status: { in: ACTIVE_CAPACITY_STATUSES },
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
    const maxActiveTasks = taskWithLimits?.taskGroup?.maxActiveTasks ?? null;
    const currentWorkloadDays = activeAssignments.reduce((total, assignment) => {
      const days = assignment.task.estDays ?? DEFAULT_TASK_DAYS;
      return total +
        (assignment.internId === internId
          ? days
          : days * SUPPORT_WORKLOAD_FACTOR);
    }, 0);
    const taskDays = task.estDays ?? DEFAULT_TASK_DAYS;
    const nextWorkloadDays = currentWorkloadDays + taskDays;
    const nextActiveTaskCount = activeAssignments.length + 1;

    if (nextWorkloadDays > maxWorkloadDays) {
      throw new AppError(
        `Không thể giao task "${task.title}": TTS sẽ vượt giới hạn workload (${currentWorkloadDays}/${maxWorkloadDays} ngày hiện tại, task cần ${taskDays} ngày)`,
        409,
        ERROR_CODE.CONFLICT,
      );
    }

    if (maxActiveTasks !== null && nextActiveTaskCount > maxActiveTasks) {
      throw new AppError(
        `Không thể giao task "${task.title}": TTS đã đạt tối đa ${maxActiveTasks} task active`,
        409,
        ERROR_CODE.CONFLICT,
      );
    }
  }

  async findAll(query: TaskAssignmentQueryDto, user: UserPayload) {
    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern) {
        throw new AppError(
          "Intern profile not found",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      query.internId = intern.id;
    }
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const assignment = await this.repository.findById(id);

    if (!assignment) {
      throw new AppError(
        "Task assignment not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return assignment;
  }

  async create(data: CreateTaskAssignmentDto, assignedBy: string, actorRole: string) {
    // 1. Check if Task exists and is not soft-deleted
    const task = await this.taskRepository.findById(data.taskId);
    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Check Task Deadline (compare date-only, allow today)
    const deadlineDay = new Date(task.deadline);
    deadlineDay.setHours(23, 59, 59, 999);
    if (deadlineDay < new Date()) {
      throw new AppError(
        "Task past deadline cannot be assigned",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Check if Intern exists and is not soft-deleted
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (intern.status !== "ACTIVE" || !intern.user.isActive) {
      throw new AppError(
        "Chỉ có thể giao việc cho thực tập sinh đang active",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (actorRole === ROLES.LEADER && intern.leaderId !== assignedBy) {
      const confirmedEmail = data.internEmail?.toLowerCase().trim();
      if (!confirmedEmail || confirmedEmail !== intern.user.email.toLowerCase()) {
        throw new AppError(
          "Email thực tập sinh là bắt buộc khi giao việc cho team khác",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // 3b. Check Department matching
    if (task.taskGroup && task.taskGroup.departmentId) {
      if (intern.department?.id !== task.taskGroup.departmentId) {
        throw new AppError(
          "Intern must belong to the same department as the task group",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // 4. Check if task is already assigned
    const existing = await this.repository.findByTaskId(data.taskId);
    if (existing) {
      throw new AppError(
        "Task has already been assigned",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    await this.ensureInternCapacity(data.internId, task);

    // 5. Determine approval workflow status
    let status: AssignmentStatus = AssignmentStatus.TODO;
    if (actorRole !== ROLES.ADMIN && intern.leaderId !== assignedBy) {
      status = AssignmentStatus.PENDING_APPROVAL;
    }

    const result = await this.repository.create(data, assignedBy, status);

    // 6. Only notify if auto-approved
    if (status === AssignmentStatus.TODO) {
      await NotificationDispatcher.dispatch(intern.userId, "TASK_ASSIGNMENT", {
        taskTitle: task.title,
        deadline: new Date(task.deadline).toLocaleDateString(),
      });
    }

    await this.activityLogService.log(
      assignedBy,
      ACTIVITY_ACTIONS.ASSIGN_TASK,
      status === AssignmentStatus.TODO
        ? `Leader đã giao công việc "${task.title}" cho Intern "${intern.fullName}"`
        : `Leader đã yêu cầu giao công việc "${task.title}" cho Intern "${intern.fullName}" (Chờ duyệt)`,
      result.id,
      "TaskAssignment",
    );

    return result;
  }

  async assignTask(
    taskId: string,
    data: AssignTaskDto,
    actorId: string,
    actorRole: string,
  ) {
    const existing = await this.repository.findByTaskId(taskId);
    if (existing) {
      return this.update(existing.id, data, actorId, actorRole);
    }

    return this.create({ taskId, ...data }, actorId, actorRole);
  }

  async unassignTask(taskId: string, actorId: string, actorRole: string) {
    const assignment = await this.repository.findByTaskId(taskId);
    if (!assignment) {
      throw new AppError(
        "Task assignment not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return this.delete(assignment.id, actorId, actorRole);
  }

  async approve(id: string, actorId: string, actorRole: string) {
    const assignment = await this.findById(id);

    if (!assignment.intern) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (assignment.status !== AssignmentStatus.PENDING_APPROVAL) {
      throw new AppError(
        "Yêu cầu giao việc không ở trạng thái chờ duyệt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Only Admin or the direct Leader of the intern is allowed to approve
    if (actorRole !== ROLES.ADMIN && assignment.intern.leaderId !== actorId) {
      throw new AppError(
        "Bạn không có quyền duyệt yêu cầu giao việc này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    await this.ensureInternCapacity(
      assignment.intern.id,
      assignment.task,
      assignment.id,
    );

    const result = await this.repository.update(id, {
      status: AssignmentStatus.TODO,
    });

    // Notify the intern of the approved assignment
    await NotificationDispatcher.dispatch(
      assignment.intern.user.id,
      "TASK_ASSIGNMENT",
      {
        taskTitle: assignment.task.title,
        deadline: new Date(assignment.task.deadline).toLocaleDateString(),
      },
    );

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_ASSIGNMENT,
      `Leader đã phê duyệt phân công công việc "${assignment.task.title}" cho Intern "${assignment.intern.fullName}"`,
      id,
      "TaskAssignment",
    );

    return result;
  }

  async reject(id: string, actorId: string, actorRole: string) {
    const assignment = await this.findById(id);

    if (!assignment.intern) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (assignment.status !== AssignmentStatus.PENDING_APPROVAL) {
      throw new AppError(
        "Yêu cầu giao việc không ở trạng thái chờ duyệt",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Only Admin or the direct Leader of the intern is allowed to reject
    if (actorRole !== ROLES.ADMIN && assignment.intern.leaderId !== actorId) {
      throw new AppError(
        "Bạn không có quyền từ chối yêu cầu giao việc này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.update(id, {
      status: AssignmentStatus.BLOCKED,
    });

    await NotificationDispatcher.dispatch(
      assignment.assignedBy,
      "TASK_ASSIGNMENT_REJECTED",
      {
        taskTitle: assignment.task.title,
        internName: assignment.intern.fullName,
      },
    );

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_ASSIGNMENT,
      `Leader đã từ chối yêu cầu giao công việc "${assignment.task.title}" cho Intern "${assignment.intern.fullName}" (chuyển sang BLOCKED)`,
      id,
      "TaskAssignment",
    );

    return result;
  }

  async update(
    id: string,
    data: UpdateTaskAssignmentDto,
    actorId: string,
    actorRole: string,
  ) {
    const assignment = await this.findById(id);

    if (!assignment.intern && data.internId === undefined) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (actorRole === ROLES.INTERN) {
      const canStartOwnAssignment =
        assignment.intern?.userId === actorId &&
        data.internId === undefined &&
        data.status === AssignmentStatus.IN_PROGRESS &&
        (assignment.status === AssignmentStatus.TODO ||
          assignment.status === AssignmentStatus.BLOCKED);

      if (!canStartOwnAssignment) {
        throw new AppError(
          "Intern can only start their own TODO or BLOCKED assignment",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    } else if (
      actorRole !== ROLES.ADMIN &&
      (assignment.intern
        ? assignment.intern.leaderId !== actorId
        : assignment.assignedBy !== actorId)
    ) {
      // Leaders can only update assignments belonging to their direct interns.
      throw new AppError(
        "Bạn không có quyền cập nhật phân công này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    this.ensureAssignmentEditable(assignment.status);

    if (data.internId !== undefined) {
      // Check if updated Intern exists and is not soft-deleted
      const intern = await this.internRepository.findById(data.internId);
      if (!intern) {
        throw new AppError(
          "Intern profile not found",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }


      if (intern.status !== "ACTIVE" || !intern.user.isActive) {
        throw new AppError(
          "Chỉ có thể giao việc cho thực tập sinh đang active",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      if (actorRole === ROLES.LEADER && intern.leaderId !== actorId) {
        const confirmedEmail = data.internEmail?.toLowerCase().trim();
        if (!confirmedEmail || confirmedEmail !== intern.user.email.toLowerCase()) {
          throw new AppError(
            "Email thực tập sinh là bắt buộc khi giao việc cho team khác",
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
        data.status = AssignmentStatus.PENDING_APPROVAL;
      } else if (actorRole !== ROLES.INTERN) {
        data.status = AssignmentStatus.TODO;
      }

      // Check Task Department Match
      if (assignment.task.taskGroup && assignment.task.taskGroup.departmentId) {
        if (intern.department?.id !== assignment.task.taskGroup.departmentId) {
          throw new AppError(
            "Intern must belong to the same department as the task group",
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
      }

      // Check Task Deadline
      if (new Date(assignment.task.deadline) < new Date()) {
        throw new AppError(
          "Task past deadline cannot be reassigned",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      if (data.internId !== assignment.internId) {
        await this.ensureInternCapacity(
          data.internId,
          assignment.task,
          assignment.id,
        );
      }
    }

    const result = await this.repository.update(id, data);

    const changes: string[] = [];
    if (data.internId !== undefined && data.internId !== assignment.internId) {
      const newIntern = await this.internRepository.findById(data.internId);
      changes.push(
        `phân công lại cho Intern "${newIntern?.fullName || data.internId}"`,
      );
    }
    if (data.status !== undefined && data.status !== assignment.status) {
      changes.push(`cập nhật trạng thái thành ${data.status}`);
    }

    if (changes.length > 0) {
      await this.activityLogService.log(
        actorId,
        ACTIVITY_ACTIONS.UPDATE_ASSIGNMENT,
        actorRole === ROLES.INTERN
          ? `Intern "${assignment.intern?.fullName ?? assignment.internId}" đã bắt đầu công việc "${assignment.task.title}"`
          : `Leader đã cập nhật phân công công việc "${assignment.task.title}": ${changes.join(", ")}`,
        result.id,
        "TaskAssignment",
      );
    }

    // If reassigned to a different intern, notify the new intern
    if (
      data.internId !== undefined &&
      data.internId !== assignment.internId &&
      result.status === AssignmentStatus.TODO
    ) {
      const newIntern = await this.internRepository.findById(data.internId);
      if (newIntern) {
        await NotificationDispatcher.dispatch(
          newIntern.userId,
          "TASK_ASSIGNMENT",
          {
            taskTitle: assignment.task.title,
            deadline: new Date(assignment.task.deadline).toLocaleDateString(),
          },
        );
      }
    }

    return result;
  }

  async delete(id: string, actorId: string, actorRole: string) {
    const assignment = await this.findById(id);

    const isDirectLeader = assignment.intern?.leaderId === actorId;
    const isAssignmentRequester = assignment.assignedBy === actorId;
    if (
      actorRole !== ROLES.ADMIN &&
      !isDirectLeader &&
      !isAssignmentRequester
    ) {
      throw new AppError(
        "Bạn không có quyền hủy phân công này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    this.ensureAssignmentEditable(assignment.status);

    const result = await this.repository.delete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_ASSIGNMENT,
      `Leader đã hủy phân công công việc "${assignment.task.title}" của Intern "${assignment.intern?.fullName ?? assignment.internId ?? "không xác định"}"`,
      id,
      "TaskAssignment",
    );

    return result;
  }
}
