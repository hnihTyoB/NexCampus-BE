import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskSubmissionQueryDto,
  CreateTaskSubmissionDto,
  UpdateTaskSubmissionDto,
} from "./task-submission.dto";

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
      assignedBy: true,
      status: true,
      assignedAt: true,
      updatedAt: true,
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          deadline: true,
          priority: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      intern: {
        select: {
          id: true,
          userId: true,
          leaderId: true,
          fullName: true,
          phone: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
          startDate: true,
          duration: true,
          discordUsername: true,
          discordRoleGranted: true,
          status: true,
          createdAt: true,
          updatedAt: true,
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
    orderBy: {
      createdAt: "desc" as const,
    },
  },
};

export class TaskSubmissionRepository {
  async findAll(query: TaskSubmissionQueryDto) {
    const {
      assignmentId,
      reviewStatus,
      reviewedBy,
      internId,
      taskId,
      sortBy = "submittedAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.TaskSubmissionWhereInput = {
      assignment: {
        task: { deletedAt: null },
        intern: { deletedAt: null },
        ...(internId ? { internId } : {}),
        ...(taskId ? { taskId } : {}),
      },
      ...(assignmentId ? { assignmentId } : {}),
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(reviewedBy ? { reviewedBy } : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.taskSubmission.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.taskSubmission.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.taskSubmission.findFirst({
      where: {
        id,
        assignment: {
          task: { deletedAt: null },
          intern: { deletedAt: null },
        },
      },
      select: defaultSelect,
    });
  }

  countAttempts(assignmentId: string) {
    return prisma.taskSubmission.count({
      where: { assignmentId },
    });
  }

  create(data: CreateTaskSubmissionDto, attempt: number) {
    return prisma.taskSubmission.create({
      data: {
        assignmentId: data.assignmentId,
        attempt,
        prLink: data.prLink || null,
        videoDemo: data.videoDemo || null,
        note: data.note || null,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateTaskSubmissionDto, reviewedBy?: string) {
    return prisma.taskSubmission.update({
      where: { id },
      data: {
        ...(data.prLink !== undefined ? { prLink: data.prLink } : {}),
        ...(data.videoDemo !== undefined ? { videoDemo: data.videoDemo } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.reviewStatus !== undefined
          ? { reviewStatus: data.reviewStatus }
          : {}),
        ...(data.reviewComment !== undefined
          ? { reviewComment: data.reviewComment }
          : {}),
        ...(reviewedBy !== undefined ? { reviewedBy } : {}),
        ...(reviewedBy !== undefined ? { reviewedAt: new Date() } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.taskSubmission.delete({
      where: { id },
    });
  }
}
