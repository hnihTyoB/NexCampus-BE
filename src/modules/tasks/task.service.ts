import { TaskRepository } from "./task.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from "./task.dto";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { ASSIGNMENT_STATUS } from "../../common/constants/status.constant";

export class TaskService {
  private readonly repository = new TaskRepository();
  private readonly activityLogService = new ActivityLogService();

  private validateSchedule(
    startDate: string | Date | null | undefined,
    deadline: string | Date,
  ) {
    if (!startDate) return;

    if (new Date(startDate).getTime() > new Date(deadline).getTime()) {
      throw new AppError(
        "Start date must be on or before deadline",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }

  async findAll(query: TaskQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const task = await this.repository.findById(id);

    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return task;
  }

  async create(data: CreateTaskDto, createdBy: string) {
    this.validateSchedule(data.startDate, data.deadline);
    const result = await this.repository.create(data, createdBy);

    await this.activityLogService.log(
      createdBy,
      ACTIVITY_ACTIONS.CREATE_TASK,
      `Leader đã tạo công việc mới: ${result.title}`,
      result.id,
      "Task",
    );

    return result;
  }

  async update(id: string, data: UpdateTaskDto, actorId: string) {
    const current = await this.findById(id);

    if (current.assignment?.status === ASSIGNMENT_STATUS.DONE) {
      throw new AppError(
        "Completed tasks cannot be edited",
        409,
        ERROR_CODE.TASK_ALREADY_COMPLETED,
      );
    }

    const nextStartDate = data.startDate === undefined ? current.startDate : data.startDate;
    const nextDeadline = data.deadline === undefined ? current.deadline : data.deadline;
    this.validateSchedule(nextStartDate, nextDeadline);

    const keys = [
      "title",
      "description",
      "deadline",
      "priority",
      "code",
      "startDate",
      "estDays",
      "phase",
      "module",
      "acceptanceCriteria",
      "taskNotes",
      "taskGroupId",
    ] as const;

    const hasChanges = keys.some((key) => {
      if (data[key] === undefined) return false;

      const currentVal = current[key];
      const newVal = data[key];

      if (key === "deadline" || key === "startDate") {
        if (!currentVal && !newVal) return false;
        if (!currentVal || !newVal) return true;
        return new Date(currentVal).getTime() !== new Date(newVal as string).getTime();
      }

      const normCurrent = currentVal === null || currentVal === undefined ? "" : currentVal;
      const normNew = newVal === null || newVal === undefined ? "" : newVal;

      return normCurrent !== normNew;
    });

    if (!hasChanges) {
      return current;
    }

    const result = await this.repository.update(id, data);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.UPDATE_TASK,
      `Leader đã cập nhật công việc: ${result.title}`,
      result.id,
      "Task",
    );

    return result;
  }

  async delete(id: string, actorId: string) {
    const task = await this.findById(id);
    const result = await this.repository.softDelete(id);

    await this.activityLogService.log(
      actorId,
      ACTIVITY_ACTIONS.DELETE_TASK,
      `Leader đã xóa công việc: ${task.title}`,
      id,
      "Task",
    );

    return result;
  }
}
