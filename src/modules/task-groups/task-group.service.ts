import { TaskGroupRepository } from "./task-group.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { CreateTaskGroupDto, UpdateTaskGroupDto } from "./task-group.dto";

export class TaskGroupService {
  private readonly repository = new TaskGroupRepository();

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: string) {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new AppError("Task group not found", 404, ERROR_CODE.NOT_FOUND);
    }
    return group;
  }

  async create(data: CreateTaskGroupDto) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateTaskGroupDto) {
    await this.findById(id);
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
