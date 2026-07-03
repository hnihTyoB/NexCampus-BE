import { TaskSubmissionRepository } from './task-submission.repository';
import { TaskAssignmentRepository } from '../task-assignments/task-assignment.repository';
import { InternRepository } from '../interns/intern.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { TaskSubmissionQueryDto, CreateTaskSubmissionDto, UpdateTaskSubmissionDto } from './task-submission.dto';
import { ROLES } from '../../common/constants/role.constant';
import { REVIEW_STATUS } from '../../common/constants/status.constant';
import { NotificationDispatcher } from '../notifications/notification.dispatcher';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class TaskSubmissionService {
  private readonly repository = new TaskSubmissionRepository();
  private readonly assignmentRepository = new TaskAssignmentRepository();
  private readonly internRepository = new InternRepository();

  async findAll(query: TaskSubmissionQueryDto, user: UserPayload) {
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
    const submission = await this.repository.findById(id);

    if (!submission) {
      throw new AppError('Task submission not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return submission;
  }

  async create(data: CreateTaskSubmissionDto, user: UserPayload) {
    // 1. Find assignment
    const assignment = await this.assignmentRepository.findById(data.assignmentId);
    if (!assignment) {
      throw new AppError('Task assignment not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Authorization check: Intern can only submit their own assignment
    if (user.role === ROLES.INTERN && assignment.intern.userId !== user.id) {
      throw new AppError('You are not authorized to submit for this assignment', 403, ERROR_CODE.FORBIDDEN);
    }

    // 3. Count attempts
    const count = await this.repository.countAttempts(data.assignmentId);
    const attempt = count + 1;

    const result = await this.repository.create(data, attempt);

    // Notify the assigner (leader/admin)
    await NotificationDispatcher.dispatch(
      assignment.assignedBy,
      'Bản nộp bài mới cần duyệt',
      `Thực tập sinh ${assignment.intern.user.fullName} đã nộp bài cho công việc "${assignment.task.title}" (Lần ${attempt}).`,
      'TASK_SUBMISSION'
    );

    // If intern has a direct leader different from the assigner, notify them too
    if (assignment.intern.leaderId && assignment.intern.leaderId !== assignment.assignedBy) {
      await NotificationDispatcher.dispatch(
        assignment.intern.leaderId,
        'Bản nộp bài mới cần duyệt',
        `Thực tập sinh ${assignment.intern.user.fullName} đã nộp bài cho công việc "${assignment.task.title}" (Lần ${attempt}).`,
        'TASK_SUBMISSION'
      );
    }

    return result;
  }

  async update(id: string, data: UpdateTaskSubmissionDto, user: UserPayload) {
    const submission = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      // 1. Intern can only update their own submission
      if (submission.assignment.intern.userId !== user.id) {
        throw new AppError('You are not authorized to update this submission', 403, ERROR_CODE.FORBIDDEN);
      }

      // 2. Intern cannot edit an already approved submission
      if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
        throw new AppError('Cannot update an approved submission', 400, ERROR_CODE.VALIDATION_ERROR);
      }

      // 3. Keep intern's modifications, reset status to PENDING for re-review
      const internData: UpdateTaskSubmissionDto = {
        prLink: data.prLink !== undefined ? data.prLink : submission.prLink,
        videoDemo: data.videoDemo !== undefined ? data.videoDemo : submission.videoDemo,
        note: data.note !== undefined ? data.note : submission.note,
        reviewStatus: REVIEW_STATUS.PENDING,
      };

      return this.repository.update(id, internData);
    } else {
      // Leader/Admin can review submission
      const reviewData: UpdateTaskSubmissionDto = {
        reviewStatus: data.reviewStatus !== undefined ? data.reviewStatus : submission.reviewStatus,
        reviewComment: data.reviewComment !== undefined ? data.reviewComment : submission.reviewComment,
      };

      // Set the reviewedBy property using repository's method
      const result = await this.repository.update(id, reviewData, user.id);

      // Notify the intern of the review status update
      await NotificationDispatcher.dispatch(
        submission.assignment.intern.userId,
        'Kết quả duyệt bài nộp',
        `Bài nộp cho công việc "${submission.assignment.task.title}" (Lần ${submission.attempt}) đã được duyệt: ${reviewData.reviewStatus}.`,
        'SUBMISSION_REVIEW'
      );

      return result;
    }
  }

  async delete(id: string, user: UserPayload) {
    const submission = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      // Intern can only delete their own submission
      if (submission.assignment.intern.userId !== user.id) {
        throw new AppError('You are not authorized to delete this submission', 403, ERROR_CODE.FORBIDDEN);
      }

      // Intern cannot delete an approved submission
      if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
        throw new AppError('Cannot delete an approved submission', 400, ERROR_CODE.VALIDATION_ERROR);
      }
    }

    return this.repository.delete(id);
  }
}
