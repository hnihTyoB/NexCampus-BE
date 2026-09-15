import { TaskSubmissionRepository } from "./task-submission.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskSubmissionQueryDto,
  CreateTaskSubmissionDto,
  ReviewSubmissionDto,
  CreateAttachmentInput,
} from "./task-submission.dto";
import { ROLES } from "../../common/constants/role.constant";
import { ASSIGNMENT_STATUS } from "../../common/constants/task.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { ReviewStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { R2Service } from "../../common/services/r2.service";
import crypto from "crypto";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class TaskSubmissionService {
  private readonly repository = new TaskSubmissionRepository();
  private readonly r2Service = new R2Service();

  async findAll(
    query: TaskSubmissionQueryDto,
    actor: UserPayload,
  ) {
    let scope: { internId?: string; leaderUserId?: string } | undefined;

    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      if (intern) {
        scope = { internId: intern.id };
      }
    } else if (actor.role === ROLES.LEADER) {
      scope = { leaderUserId: actor.id };
    }

    return this.repository.findAll(query, scope);
  }

  async findById(id: string, actor: UserPayload) {
    const submission = await this.repository.findById(id);
    if (!submission) {
      throw new AppError(
        "Bài nộp không tồn tại",
        404,
        ERROR_CODE.SUBMISSION_NOT_FOUND,
      );
    }

    // Permission check
    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      const isOwner = intern && submission.assignment.internId === intern.id;
      const isSupport = intern && submission.assignment.supportId === intern.id;
      if (!isOwner && !isSupport) {
        throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
      }
    } else if (actor.role === ROLES.LEADER) {
      const isLeaderOfOwner = submission.assignment.intern?.leaderId === actor.id;
      const isLeaderOfSupport = submission.assignment.support?.leaderId === actor.id;
      if (!isLeaderOfOwner && !isLeaderOfSupport) {
        throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
      }
    }

    return submission;
  }

  async create(
    dto: CreateTaskSubmissionDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const assignment = await prisma.taskAssignment.findUnique({
      where: { id: dto.assignmentId },
      include: {
        intern: true,
        support: true,
        task: true,
      },
    });

    if (!assignment) {
      throw new AppError(
        "Phân công công việc không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // Lock check: DONE assignments cannot receive submissions
    if (assignment.status === ASSIGNMENT_STATUS.DONE) {
      throw new AppError(
        "Công việc đã hoàn thành, không thể nộp bài thêm",
        409,
        ERROR_CODE.TASK_ALREADY_COMPLETED,
      );
    }

    // Permission check: only assigned intern (or admin) can submit
    if (actor.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
      });
      const isOwner = intern && assignment.internId === intern.id;
      const isSupport = intern && assignment.supportId === intern.id;
      if (!isOwner && !isSupport) {
        throw new AppError(
          "Bạn chỉ được nộp bài cho công việc được phân công cho mình",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // ĐIỀU KIỆN TIÊN QUYẾT: Assignment BẮT BUỘC đang ở trạng thái IN_PROGRESS.
    // Nếu đang TODO (kể cả task vừa bị Leader từ chối trả về TODO), từ chối request và trả lỗi hướng dẫn TTS bấm bắt đầu làm trước khi nộp.
    if (assignment.status === ASSIGNMENT_STATUS.TODO) {
      throw new AppError(
        "Vui lòng bấm 'Bắt đầu làm' công việc trước khi nộp bài",
        400,
        ERROR_CODE.TASK_NOT_IN_PROGRESS,
      );
    }

    if (assignment.status !== ASSIGNMENT_STATUS.IN_PROGRESS) {
      throw new AppError(
        `Không thể nộp bài khi công việc đang ở trạng thái ${assignment.status}. Công việc phải ở trạng thái Đang làm (IN_PROGRESS)`,
        400,
        ERROR_CODE.TASK_NOT_IN_PROGRESS,
      );
    }

    // Tự động tính số lần nộp (attempt: lần 1, lần 2, ...)
    const currentAttempts = await this.repository.countAttempts(dto.assignmentId);
    const attempt = currentAttempts + 1;

    const submission = await this.repository.createWithTransaction(
      dto,
      attempt,
      actor.id,
    );

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CREATE_SUBMISSION,
      targetType: AUDIT_TARGET_TYPE.TASK_SUBMISSION,
      targetId: submission.id,
      details: {
        assignmentId: dto.assignmentId,
        attempt,
        hasPrLink: !!dto.prLink,
        hasVideoDemo: !!dto.videoDemo,
        attachmentCount: dto.attachments?.length || 0,
      },
      ipAddress: context?.ipAddress,
    });

    return submission;
  }

  async review(
    id: string,
    dto: ReviewSubmissionDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const submission = await this.repository.findById(id);
    if (!submission) {
      throw new AppError(
        "Bài nộp không tồn tại",
        404,
        ERROR_CODE.SUBMISSION_NOT_FOUND,
      );
    }

    if (submission.reviewStatus !== ReviewStatus.PENDING) {
      throw new AppError(
        "Bài nộp này đã được đánh giá trước đó",
        400,
        ERROR_CODE.SUBMISSION_ALREADY_REVIEWED,
      );
    }

    // Phân quyền: Quyền Leader trực tiếp hoặc Admin đánh giá
    const isDirectLeader =
      submission.assignment?.intern?.leaderId === actor.id ||
      submission.assignment?.support?.leaderId === actor.id;

    if (actor.role !== ROLES.ADMIN && !isDirectLeader) {
      throw new AppError(
        "Chỉ Leader trực tiếp quản lý TTS hoặc Admin mới có quyền đánh giá bài nộp",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // Yêu cầu làm lại (REJECTED): Bắt buộc nhập reviewComment (nhận xét lý do cần sửa)
    if (
      dto.reviewStatus === ReviewStatus.REJECTED &&
      (!dto.reviewComment || !dto.reviewComment.trim())
    ) {
      throw new AppError(
        "Nhận xét lý do cần sửa (reviewComment) là bắt buộc khi yêu cầu làm lại",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const result = await this.repository.reviewWithTransaction(
      id,
      submission.assignmentId,
      dto,
      actor.id,
    );

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.REVIEW_SUBMISSION,
      targetType: AUDIT_TARGET_TYPE.TASK_SUBMISSION,
      targetId: id,
      details: {
        assignmentId: submission.assignmentId,
        reviewStatus: dto.reviewStatus,
        reviewComment: dto.reviewComment,
      },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async getUploadUrl(
    fileName: string,
    mimeType: string,
    actor: UserPayload,
  ) {
    const fileExt = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const baseName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomUUID();
    // Storage Cloudflare R2 với prefix submissions/ theo yêu cầu
    const key = `submissions/${uniqueId}_${baseName}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(key, mimeType);
    const fileUrl = this.r2Service.getPublicUrl(key);

    return {
      uploadUrl,
      fileUrl,
      filePath: key,
    };
  }

  async addAttachment(
    submissionId: string,
    data: CreateAttachmentInput,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const submission = await this.repository.findById(submissionId);
    if (!submission) {
      throw new AppError(
        "Bài nộp không tồn tại",
        404,
        ERROR_CODE.SUBMISSION_NOT_FOUND,
      );
    }

    if (submission.reviewStatus === ReviewStatus.APPROVED) {
      throw new AppError(
        "Không thể thêm tệp đính kèm cho bài nộp đã được duyệt",
        400,
        ERROR_CODE.SUBMISSION_CANNOT_EDIT,
      );
    }

    const attachment = await this.repository.addAttachment(
      submissionId,
      data,
      actor.id,
    );

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.UPLOAD_SUBMISSION_ATTACHMENT,
      targetType: AUDIT_TARGET_TYPE.SUBMISSION_ATTACHMENT,
      targetId: attachment.id,
      details: { submissionId, fileName: data.fileName },
      ipAddress: context?.ipAddress,
    });

    return attachment;
  }

  async deleteAttachment(
    submissionId: string,
    attachmentId: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const attachment = await this.repository.findAttachment(attachmentId);
    if (!attachment || attachment.submissionId !== submissionId) {
      throw new AppError(
        "Tệp đính kèm không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (attachment.submission.reviewStatus === ReviewStatus.APPROVED) {
      throw new AppError(
        "Không thể xóa tệp đính kèm của bài nộp đã được duyệt",
        400,
        ERROR_CODE.SUBMISSION_CANNOT_EDIT,
      );
    }

    if (actor.role === ROLES.INTERN && attachment.uploadedBy !== actor.id) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    // Try deleting from R2
    if (attachment.filePath) {
      await this.r2Service.deleteFile(attachment.filePath).catch(() => {});
    }

    const result = await this.repository.deleteAttachment(attachmentId);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.DELETE_SUBMISSION_ATTACHMENT,
      targetType: AUDIT_TARGET_TYPE.SUBMISSION_ATTACHMENT,
      targetId: attachmentId,
      details: { submissionId, fileName: attachment.fileName },
      ipAddress: context?.ipAddress,
    });

    return result;
  }
}
