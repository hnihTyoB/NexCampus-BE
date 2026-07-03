import { TaskAssignmentRepository } from './task-assignment.repository';
import { TaskRepository } from '../tasks/task.repository';
import { InternRepository } from '../interns/intern.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { TaskAssignmentQueryDto, CreateTaskAssignmentDto, UpdateTaskAssignmentDto } from './task-assignment.dto';
import { ROLES } from '../../common/constants/role.constant';
import { NotificationDispatcher } from '../notifications/notification.dispatcher';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class TaskAssignmentService {
  private readonly repository = new TaskAssignmentRepository();
  private readonly taskRepository = new TaskRepository();
  private readonly internRepository = new InternRepository();

  async findAll(query: TaskAssignmentQueryDto, user: UserPayload) {
    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern) {
        throw new AppError('Intern profile not found', 404, ERROR_CODE.NOT_FOUND);
      }
      query.internId = intern.id;
    }
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const assignment = await this.repository.findById(id);

    if (!assignment) {
      throw new AppError('Task assignment not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return assignment;
  }

  async create(data: CreateTaskAssignmentDto, assignedBy: string) {
    // 1. Check if Task exists and is not soft-deleted
    const task = await this.taskRepository.findById(data.taskId);
    if (!task) {
      throw new AppError('Task not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Check Task Deadline
    if (new Date(task.deadline) < new Date()) {
      throw new AppError('Task past deadline cannot be assigned', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    // 3. Check if Intern exists and is not soft-deleted
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError('Intern profile not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // 4. Check if task is already assigned
    const existing = await this.repository.findByTaskId(data.taskId);
    if (existing) {
      throw new AppError('Task has already been assigned', 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    const result = await this.repository.create(data, assignedBy);

    // Notify the intern of the new task assignment
    await NotificationDispatcher.dispatch(
      intern.userId,
      'TASK_ASSIGNMENT',
      {
        taskTitle: task.title,
        deadline: new Date(task.deadline).toLocaleDateString(),
      }
    );

    return result;
  }

  async update(id: string, data: UpdateTaskAssignmentDto) {
    const assignment = await this.findById(id);

    if (data.internId !== undefined) {
      // Check if updated Intern exists and is not soft-deleted
      const intern = await this.internRepository.findById(data.internId);
      if (!intern) {
        throw new AppError('Intern profile not found', 404, ERROR_CODE.NOT_FOUND);
      }

      // Check Task Deadline
      if (new Date(assignment.task.deadline) < new Date()) {
        throw new AppError('Task past deadline cannot be reassigned', 400, ERROR_CODE.VALIDATION_ERROR);
      }
    }

    const result = await this.repository.update(id, data);

    // If reassigned to a different intern, notify the new intern
    if (data.internId !== undefined && data.internId !== assignment.internId) {
      const newIntern = await this.internRepository.findById(data.internId);
      if (newIntern) {
        await NotificationDispatcher.dispatch(
          newIntern.userId,
          'TASK_ASSIGNMENT',
          {
            taskTitle: assignment.task.title,
            deadline: new Date(assignment.task.deadline).toLocaleDateString(),
          }
        );
      }
    }

    return result;
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.delete(id);
  }
}
