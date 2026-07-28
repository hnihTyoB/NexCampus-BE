import { TaskAssignmentRepository } from "./task-assignment.repository";
import { TaskRepository } from "../tasks/task.repository";
import { InternRepository } from "../interns/intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
} from "./task-assignment.dto";
import { ROLES } from "../../common/constants/role.constant";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { AssignmentStatus } from "@prisma/client";

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

    // 4. Check if task is already assigned
    const existing = await this.repository.findByTaskId(data.taskId);
    if (existing) {
      throw new AppError(
        "Task has already been assigned",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

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

    if (!assignment.intern) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // Only Admin or the direct Leader of the intern is allowed to update
    if (actorRole !== ROLES.ADMIN && assignment.intern.leaderId !== actorId) {
      throw new AppError(
        "Bạn không có quyền cập nhật phân công này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

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

      // Check Task Deadline
      if (new Date(assignment.task.deadline) < new Date()) {
        throw new AppError(
          "Task past deadline cannot be reassigned",
          400,
          ERROR_CODE.VALIDATION_ERROR,
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
        `Leader đã cập nhật phân công công việc "${assignment.task.title}": ${changes.join(", ")}`,
        result.id,
        "TaskAssignment",
      );
    }

    // If reassigned to a different intern, notify the new intern
    if (data.internId !== undefined && data.internId !== assignment.internId) {
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

    if (!assignment.intern) {
      throw new AppError(
        "Intern profile associated with this assignment was not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // Only Admin or the direct Leader of the intern is allowed to delete
    if (actorRole !== ROLES.ADMIN && assignment.intern.leaderId !== actorId) {
      throw new AppError(
        "Bạn không có quyền hủy phân công này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.delete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_ASSIGNMENT,
      `Leader đã hủy phân công công việc "${assignment.task.title}" của Intern "${assignment.intern.fullName}"`,
      id,
      "TaskAssignment",
    );

    return result;
  }
}
