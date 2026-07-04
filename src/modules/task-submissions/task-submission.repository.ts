import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { TaskSubmissionQueryDto, CreateTaskSubmissionDto, UpdateTaskSubmissionDto } from './task-submission.dto';

const defaultInclude = {
  assignment: {
    include: {
      task: true,
      intern: {
        include: {
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
    orderBy: {
      createdAt: 'desc' as const,
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
      sortBy = 'submittedAt',
      order = 'desc',
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
        include: defaultInclude,
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
      include: defaultInclude,
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
      include: defaultInclude,
    });
  }

  update(id: string, data: UpdateTaskSubmissionDto, reviewedBy?: string) {
    return prisma.taskSubmission.update({
      where: { id },
      data: {
        ...(data.prLink !== undefined ? { prLink: data.prLink } : {}),
        ...(data.videoDemo !== undefined ? { videoDemo: data.videoDemo } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.reviewStatus !== undefined ? { reviewStatus: data.reviewStatus } : {}),
        ...(data.reviewComment !== undefined ? { reviewComment: data.reviewComment } : {}),
        ...(reviewedBy !== undefined ? { reviewedBy } : {}),
        ...(reviewedBy !== undefined ? { reviewedAt: new Date() } : {}),
      },
      include: defaultInclude,
    });
  }

  delete(id: string) {
    return prisma.taskSubmission.delete({
      where: { id },
    });
  }
}
