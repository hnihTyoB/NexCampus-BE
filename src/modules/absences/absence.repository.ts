import { Prisma, AbsenceStatus, AssignmentStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  AbsenceQueryDto,
  CreateAbsenceDto,
  ReviewAbsenceDto,
  TaskConflictDto,
} from "./absence.dto";
import { SYSTEM_TARGET_ID } from "../../common/constants/audit-log.constant";

const defaultAbsenceSelect = {
  id: true,
  userId: true,
  startDate: true,
  endDate: true,
  durationUnit: true,
  reasonType: true,
  reason: true,
  evidenceUrl: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      intern: {
        select: {
          id: true,
          leaderId: true,
          internCode: true,
          department: {
            select: {
              id: true,
              name: true,
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
};

export class AbsenceRepository {
  async findAll(
    query: AbsenceQueryDto,
    scope?: {
      userId?: string;
      leaderUserId?: string;
    },
  ) {
    const {
      status,
      userId,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.AbsenceWhereInput = {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(scope?.userId ? { userId: scope.userId } : {}),
      ...(scope?.leaderUserId
        ? {
            user: {
              intern: {
                leaderId: scope.leaderUserId,
              },
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            startDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: "insensitive" } },
              {
                user: {
                  fullName: { contains: search, mode: "insensitive" },
                },
              },
              {
                user: {
                  email: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      prisma.absence.count({ where }),
      prisma.absence.findMany({
        where,
        select: defaultAbsenceSelect,
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
    return prisma.absence.findUnique({
      where: { id },
      select: defaultAbsenceSelect,
    });
  }

  async findOverlapping(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ) {
    return prisma.absence.findFirst({
      where: {
        userId,
        id: excludeId ? { not: excludeId } : undefined,
        status: { in: [AbsenceStatus.PENDING, AbsenceStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        reason: true,
      },
    });
  }

  async create(data: CreateAbsenceDto, userId: string) {
    return prisma.absence.create({
      data: {
        userId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        durationUnit: data.durationUnit ?? "FULL_DAY",
        reasonType: data.reasonType ?? "PERSONAL",
        reason: data.reason,
        evidenceUrl: data.evidenceUrl || null,
        status: AbsenceStatus.PENDING,
      },
      select: defaultAbsenceSelect,
    });
  }

  async review(
    id: string,
    dto: ReviewAbsenceDto,
    reviewedBy: string,
  ) {
    return prisma.absence.update({
      where: { id },
      data: {
        status: dto.status as AbsenceStatus,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote || null,
      },
      select: defaultAbsenceSelect,
    });
  }

  async cancel(id: string) {
    return prisma.absence.update({
      where: { id },
      data: {
        status: AbsenceStatus.CANCELLED,
      },
      select: defaultAbsenceSelect,
    });
  }

  async delete(id: string) {
    return prisma.absence.delete({
      where: { id },
    });
  }

  /**
   * Quét và tìm các task của intern có deadline trùng với đợt nghỉ
   */
  async findConflictTasks(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TaskConflictDto[]> {
    const intern = await prisma.intern.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!intern) return [];

    // Quét các assignment chưa hoàn thành
    const uncompletedStatuses = [
      AssignmentStatus.TODO,
      AssignmentStatus.IN_PROGRESS,
      AssignmentStatus.BLOCKED,
      AssignmentStatus.REVIEW,
      AssignmentStatus.EXTENSION_PENDING,
      AssignmentStatus.PENDING_APPROVAL,
    ];

    // Khoảng quét: từ đầu ngày startDate đến cuối ngày endDate (cộng thêm 23h59)
    const startRange = new Date(startDate);
    startRange.setHours(0, 0, 0, 0);
    const endRange = new Date(endDate);
    endRange.setHours(23, 59, 59, 999);

    const assignments = await prisma.taskAssignment.findMany({
      where: {
        internId: intern.id,
        status: { in: uncompletedStatuses },
        task: {
          deletedAt: null,
          deadline: {
            gte: startRange,
            lte: endRange,
          },
        },
      },
      include: {
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            deadline: true,
            priority: true,
          },
        },
      },
      orderBy: {
        task: {
          deadline: "asc",
        },
      },
    });

    return assignments.map((a) => ({
      taskId: a.task.id,
      code: a.task.code,
      title: a.task.title,
      deadline: a.task.deadline,
      status: a.status,
      priority: a.task.priority,
    }));
  }

  /**
   * Tự động gia hạn deadline cho các task bị trùng
   */
  async extendTaskDeadlines(
    taskIds: string[],
    daysToAdd: number,
    actorId: string,
  ) {
    if (taskIds.length === 0 || daysToAdd <= 0) return [];

    const updatedTasks = [];
    for (const taskId of taskIds) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, deadline: true, taskNotes: true },
      });

      if (task) {
        const newDeadline = new Date(
          task.deadline.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
        );

        const updated = await prisma.task.update({
          where: { id: taskId },
          data: {
            deadline: newDeadline,
            taskNotes: task.taskNotes
              ? `${task.taskNotes}\n[Hệ thống]: Gia hạn +${daysToAdd} ngày do kỳ nghỉ phép đã duyệt.`
              : `[Hệ thống]: Gia hạn +${daysToAdd} ngày do kỳ nghỉ phép đã duyệt.`,
          },
        });
        updatedTasks.push(updated);
      }
    }

    return updatedTasks;
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || SYSTEM_TARGET_ID,
        details: data.details as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
      },
    });
  }
}
