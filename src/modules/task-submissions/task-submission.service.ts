import { randomUUID } from "crypto";
import { TaskSubmissionRepository } from "./task-submission.repository";
import { TaskAssignmentRepository } from "../task-assignments/task-assignment.repository";
import { InternRepository } from "../interns/intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskSubmissionQueryDto,
  CreateTaskSubmissionDto,
  UpdateTaskSubmissionDto,
} from "./task-submission.dto";
import { ROLES } from "../../common/constants/role.constant";
import { REVIEW_STATUS, ASSIGNMENT_STATUS } from "../../common/constants/status.constant";
import { prisma } from "../../database/prisma.client";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { StorageService } from "../../common/services/storage.service";
import { envConfig } from "../../config/env.config";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class TaskSubmissionService {
  private readonly repository = new TaskSubmissionRepository();
  private readonly assignmentRepository = new TaskAssignmentRepository();
  private readonly internRepository = new InternRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: TaskSubmissionQueryDto, user: UserPayload) {
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
    const submission = await this.repository.findById(id);

    if (!submission) {
      throw new AppError(
        "Task submission not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return submission;
  }

  async getThread(assignmentId: string) {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new AppError(
        "Task assignment not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const submissions = await this.repository.findByAssignmentId(assignmentId);

    return {
      assignment: {
        id: assignment.id,
        status: assignment.status,
        task: assignment.task,
        intern: assignment.intern,
        assigner: assignment.assigner,
      },
      thread: submissions,
    };
  }

  async create(data: CreateTaskSubmissionDto, user: UserPayload) {
    // 1. Find assignment
    const assignment = await this.assignmentRepository.findById(
      data.assignmentId,
    );
    if (!assignment) {
      throw new AppError(
        "Task assignment not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // 2. Authorization check: Intern can only submit their own assignment
    if (user.role === ROLES.INTERN && assignment.intern.userId !== user.id) {
      throw new AppError(
        "You are not authorized to submit for this assignment",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // 3. Count attempts
    const count = await this.repository.countAttempts(data.assignmentId);
    const attempt = count + 1;

    const result = await this.repository.create(data, attempt);

    // Auto-update assignment status to REVIEW when intern submits
    if (assignment.status === ASSIGNMENT_STATUS.TODO || assignment.status === ASSIGNMENT_STATUS.IN_PROGRESS) {
      try {
        await prisma.taskAssignment.update({
          where: { id: assignment.id },
          data: { status: "REVIEW" as any },
        });
        console.log(`[Submission] Auto-updated assignment ${assignment.id} status to REVIEW`);
      } catch (err) {
        console.error("[Submission] Failed to auto-update assignment status:", err);
      }
    }

    // Notify the assigner (leader/admin)
    await NotificationDispatcher.dispatch(
      assignment.assignedBy,
      "TASK_SUBMISSION",
      {
        internName: assignment.intern.user.fullName,
        taskTitle: assignment.task.title,
        attempt,
      },
    );

    // If intern has a direct leader different from the assigner, notify them too
    if (
      assignment.intern.leaderId &&
      assignment.intern.leaderId !== assignment.assignedBy
    ) {
      await NotificationDispatcher.dispatch(
        assignment.intern.leaderId,
        "TASK_SUBMISSION",
        {
          internName: assignment.intern.user.fullName,
          taskTitle: assignment.task.title,
          attempt,
        },
      );
    }

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.CREATE_SUBMISSION,
      `Intern "${assignment.intern.fullName || user.email}" đã nộp bài giải lần ${attempt} cho Task: "${assignment.task.title}"`,
      result.id,
      "TaskSubmission",
    );

    return result;
  }

  async update(id: string, data: UpdateTaskSubmissionDto, user: UserPayload) {
    const submission = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      // 1. Intern can only update their own submission
      if (submission.assignment.intern.userId !== user.id) {
        throw new AppError(
          "You are not authorized to update this submission",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }

      // 2. Intern cannot edit an already approved submission
      if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
        throw new AppError(
          "Cannot update an approved submission",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      // 3. Keep intern's modifications, reset status to PENDING for re-review
      const internData: UpdateTaskSubmissionDto = {
        prLink: data.prLink !== undefined ? data.prLink : submission.prLink,
        videoDemo:
          data.videoDemo !== undefined ? data.videoDemo : submission.videoDemo,
        note: data.note !== undefined ? data.note : submission.note,
        reviewStatus: REVIEW_STATUS.PENDING,
      };

      // Create a new submission version (preserve history)
      const count = await this.repository.countAttempts(submission.assignmentId);
      const result = await this.repository.create(
        {
          assignmentId: submission.assignmentId,
          prLink: internData.prLink ?? undefined,
          videoDemo: internData.videoDemo ?? undefined,
          note: internData.note ?? undefined,
        },
        count + 1,
      );

      // Auto-update assignment status to REVIEW on re-submit
      if (
        submission.assignment.status === ASSIGNMENT_STATUS.TODO ||
        submission.assignment.status === ASSIGNMENT_STATUS.IN_PROGRESS
      ) {
        try {
          await prisma.taskAssignment.update({
            where: { id: submission.assignmentId },
            data: { status: ASSIGNMENT_STATUS.REVIEW },
          });
        } catch (err) {
          console.error("[Submission] Failed to auto-update assignment status on re-submit:", err);
        }
      }

      await this.activityLogService.log(
        user.id,
        ACTIVITY_ACTIONS.UPDATE_SUBMISSION,
        `Intern "${submission.assignment.intern.fullName || user.email}" nộp bài giải lần ${count + 1} cho Task: "${submission.assignment.task.title}"`,
        result.id,
        "TaskSubmission",
      );

      return result;
    } else {
      // Leader/Admin can review submission
      const reviewData: UpdateTaskSubmissionDto = {
        reviewStatus:
          data.reviewStatus !== undefined
            ? data.reviewStatus
            : submission.reviewStatus,
        reviewComment:
          data.reviewComment !== undefined
            ? data.reviewComment
            : submission.reviewComment,
      };

      // Set the reviewedBy property using repository's method
      const result = await this.repository.update(id, reviewData, user.id);

      if (reviewData.reviewStatus === REVIEW_STATUS.APPROVED) {
        await prisma.taskAssignment.update({
          where: { id: submission.assignmentId },
          data: { status: ASSIGNMENT_STATUS.DONE },
        });
      } else if (reviewData.reviewStatus === REVIEW_STATUS.REJECTED) {
        await prisma.taskAssignment.update({
          where: { id: submission.assignmentId },
          data: { status: ASSIGNMENT_STATUS.TODO },
        });
      }

      // Notify the intern of the review status update
      await NotificationDispatcher.dispatch(
        submission.assignment.intern.userId,
        "SUBMISSION_REVIEW",
        {
          taskTitle: submission.assignment.task.title,
          attempt: submission.attempt,
          reviewStatus: reviewData.reviewStatus,
        },
      );

      const actionText =
        reviewData.reviewStatus === REVIEW_STATUS.APPROVED
          ? "duyệt"
          : "từ chối";
      await this.activityLogService.log(
        user.id,
        ACTIVITY_ACTIONS.REVIEW_SUBMISSION,
        `Leader đã ${actionText} bài nộp lần ${submission.attempt} của Intern "${submission.assignment.intern.fullName}" cho Task: "${submission.assignment.task.title}"`,
        result.id,
        "TaskSubmission",
      );

      return result;
    }
  }

  async uploadVideoDemo(
    id: string,
    file: Express.Multer.File,
    user: UserPayload,
  ) {
    const submission = await this.findById(id);

    // 1. Authorization check: Intern can only upload for their own submission
    if (
      user.role === ROLES.INTERN &&
      submission.assignment.intern.userId !== user.id
    ) {
      throw new AppError(
        "You are not authorized to upload for this submission",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // 2. Check status: cannot upload if APPROVED
    if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
      throw new AppError(
        "Cannot upload video demo for an approved submission",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Delete old video file from storage if it exists and was uploaded to our bucket
    const bucket = envConfig.supabase.storageSubmissionBucket;
    const storageService = new StorageService();

    if (submission.videoDemo) {
      const prefix = `${envConfig.supabase.url}/storage/v1/object/public/${bucket}/`;
      if (submission.videoDemo.startsWith(prefix)) {
        const videoPath = submission.videoDemo.replace(prefix, "");
        try {
          await storageService.deleteFile(bucket, videoPath);
        } catch (err) {
          console.error(`Failed to delete old video demo from storage:`, err);
        }
      }
    }

    // 4. Upload new video file
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${id}/video_${randomUUID()}_${safeFileName}`;
    const videoUrl = await storageService.uploadFile(
      bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // 5. Update submission in DB
    return this.repository.update(id, { videoDemo: videoUrl });
  }

  async delete(id: string, user: UserPayload) {
    const submission = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      // Intern can only delete their own submission
      if (submission.assignment.intern.userId !== user.id) {
        throw new AppError(
          "You are not authorized to delete this submission",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }

      // Intern cannot delete an approved submission
      if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
        throw new AppError(
          "Cannot delete an approved submission",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // Delete associated files from Supabase Storage
    const bucket = envConfig.supabase.storageSubmissionBucket;
    const storageService = new StorageService();

    // 1. Delete submission attachments
    if (submission.attachments && submission.attachments.length > 0) {
      for (const attachment of submission.attachments) {
        try {
          await storageService.deleteFile(bucket, attachment.filePath);
        } catch (err) {
          console.error(
            `Failed to delete storage file ${attachment.filePath}:`,
            err,
          );
        }
      }
    }

    // 2. Delete video demo if it is uploaded to our bucket
    if (submission.videoDemo) {
      const prefix = `${envConfig.supabase.url}/storage/v1/object/public/${bucket}/`;
      if (submission.videoDemo.startsWith(prefix)) {
        const videoPath = submission.videoDemo.replace(prefix, "");
        try {
          await storageService.deleteFile(bucket, videoPath);
        } catch (err) {
          console.error(`Failed to delete video demo from storage:`, err);
        }
      }
    }

    const result = await this.repository.delete(id);

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.DELETE_SUBMISSION,
      `Người dùng đã xóa bài nộp lần ${submission.attempt} cho Task: "${submission.assignment.task.title}"`,
      id,
      "TaskSubmission",
    );

    return result;
  }
}
