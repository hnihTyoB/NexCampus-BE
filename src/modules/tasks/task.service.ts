import { TaskRepository } from "./task.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from "./task.dto";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

export class TaskService {
  private readonly repository = new TaskRepository();
  private readonly activityLogService = new ActivityLogService();

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
    await this.findById(id);
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
