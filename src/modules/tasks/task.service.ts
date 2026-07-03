import { TaskRepository } from './task.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from './task.dto';

export class TaskService {
  private readonly repository = new TaskRepository();

  async findAll(query: TaskQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const task = await this.repository.findById(id);

    if (!task) {
      throw new AppError('Task not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return task;
  }

  async create(data: CreateTaskDto, createdBy: string) {
    return this.repository.create(data, createdBy);
  }

  async update(id: string, data: UpdateTaskDto) {
    await this.findById(id);

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.softDelete(id);
  }
}
