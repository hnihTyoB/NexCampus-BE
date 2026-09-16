import { Prisma, ReviewStatus, AssignmentStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskSubmissionQueryDto,
  CreateTaskSubmissionDto,
  ReviewSubmissionDto,
  CreateAttachmentInput,
} from "./task-submission.dto";
import { ASSIGNMENT_STATUS } from "../../common/constants/task.constant";
import { SYSTEM_TARGET_ID } from "../../common/constants/audit-log.constant";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

const defaultSelect = {
  id: true,
  assignmentId: true,
  attempt: true,
  prLink: true,
  videoDemo: true,
  note: true,
  reviewStatus: true,
  reviewComment: true,
  reviewedBy: true,
  reviewedAt: true,
  submittedAt: true,
  updatedAt: true,
  assignment: {
    select: {
      id: true,
      taskId: true,
      internId: true,
      supportId: true,
      status: true,
      task: {
        select: {
          id: true,
          code: true,
          title: true,
          deadline: true,
        },
      },
      intern: {
        select: {
          id: true,
          leaderId: true,
          fullName: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      },
      support: {
        select: {
          id: true,
          leaderId: true,
          fullName: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  },
  reviewer: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  attachments: {
    select: {
      id: true,
      submissionId: true,
      fileName: true,
      fileUrl: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export class TaskSubmissionRepository {
  async findAll(
    query: TaskSubmissionQueryDto,
    scope?: {
      internId?: string;
      leaderUserId?: string;
    },
  ) {
    const {
      assignmentId,
      internId,
      reviewStatus,
      sortBy = "submittedAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.TaskSubmissionWhereInput = {
      ...(assignmentId ? { assignmentId } : {}),
      ...(reviewStatus ? { reviewStatus } : {}),
      assignment: {
        ...(internId
          ? { OR: [{ internId }, { supportId: internId }] }
          : {}),
        ...(scope?.internId
          ? { OR: [{ internId: scope.internId }, { supportId: scope.internId }] }
          : {}),
        ...(scope?.leaderUserId
          ? {
              OR: [
                { intern: { leaderId: scope.leaderUserId } },
                { support: { leaderId: scope.leaderUserId } },
              ],
            }
          : {}),
      },
    };

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      prisma.taskSubmission.count({ where }),
      prisma.taskSubmission.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.taskSubmission.findUnique({
      where: { id },
      select: defaultSelect,
    });
  }

  async countAttempts(assignmentId: string): Promise<number> {
    return prisma.taskSubmission.count({
      where: { assignmentId },
    });
  }

  async createWithTransaction(
    data: CreateTaskSubmissionDto,
    uploaderId: string,
    explicitAttempt?: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const attempt =
        explicitAttempt ??
        ((await tx.taskSubmission.count({
          where: { assignmentId: data.assignmentId },
        })) + 1);

      const submission = await tx.taskSubmission.create({
        data: {
          assignmentId: data.assignmentId,
          attempt,
          prLink: data.prLink || null,
          videoDemo: data.videoDemo || null,
          note: data.note || null,
          reviewStatus: ReviewStatus.PENDING,
          attachments: data.attachments && data.attachments.length > 0
            ? {
                createMany: {
                  data: data.attachments.map((att) => ({
                    fileName: att.fileName,
                    fileUrl: att.fileUrl,
                    filePath: att.filePath,
                    mimeType: att.mimeType,
                    fileSize: att.fileSize,
                    uploadedBy: uploaderId,
                  })),
                },
              }
            : undefined,
        },
        select: defaultSelect,
      });

      // Update assignment status to REVIEW
      await tx.taskAssignment.update({
        where: { id: data.assignmentId },
        data: { status: ASSIGNMENT_STATUS.REVIEW as AssignmentStatus },
      });

      return submission;
    });
  }

  async reviewWithTransaction(
    submissionId: string,
    assignmentId: string,
    dto: ReviewSubmissionDto,
    reviewerId: string,
  ) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updatedSubmission = await tx.taskSubmission.update({
        where: { id: submissionId },
        data: {
          reviewStatus: dto.reviewStatus,
          reviewComment: dto.reviewComment || null,
          reviewedBy: reviewerId,
          reviewedAt: now,
        },
        select: defaultSelect,
      });

      const nextAssignmentStatus =
        dto.reviewStatus === ReviewStatus.APPROVED
          ? ASSIGNMENT_STATUS.DONE
          : ASSIGNMENT_STATUS.TODO;

      await tx.taskAssignment.update({
        where: { id: assignmentId },
        data: {
          status: nextAssignmentStatus as AssignmentStatus,
          completedAt: dto.reviewStatus === ReviewStatus.APPROVED ? now : null,
        },
      });

      return updatedSubmission;
    });
  }

  async addAttachment(
    submissionId: string,
    data: CreateAttachmentInput,
    uploadedBy: string,
  ) {
    return prisma.submissionAttachment.create({
      data: {
        submissionId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        filePath: data.filePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        uploadedBy,
      },
    });
  }

  async findAttachment(attachmentId: string) {
    return prisma.submissionAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        submission: {
          select: {
            id: true,
            reviewStatus: true,
            assignmentId: true,
            assignment: {
              select: {
                internId: true,
                supportId: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteAttachment(attachmentId: string) {
    return prisma.submissionAttachment.delete({
      where: { id: attachmentId },
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return activityLogRepository.create(data);
  }
}

export const taskSubmissionRepository = new TaskSubmissionRepository();
