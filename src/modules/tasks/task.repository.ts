import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskQueryDto,
  CreateTaskDto,
  UpdateTaskDto,
  ConfirmAttachmentUploadDto,
  CreateLinkAttachmentDto,
} from "./task.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

const creatorSelect = {
  id: true,
  email: true,
  fullName: true,
};

const defaultSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  deadline: true,
  startDate: true,
  estDays: true,
  phase: true,
  module: true,
  acceptanceCriteria: true,
  taskNotes: true,
  priority: true,
  taskGroupId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  taskGroup: {
    select: { id: true, name: true, departmentId: true },
  },
  creator: { select: creatorSelect },
  assignment: {
    select: {
      id: true,
      taskId: true,
      internId: true,
      supportId: true,
      assignedBy: true,
      status: true,
      blockedReason: true,
      assignedAt: true,
      updatedAt: true,
      intern: { select: { id: true, fullName: true, leaderId: true } },
      support: { select: { id: true, fullName: true, leaderId: true } },
      extensionRequests: {
        select: {
          id: true,
          proposedDeadline: true,
          currentDeadline: true,
          extensionDays: true,
          reason: true,
          commitmentPlan: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" as const },
        take: 5,
      },
    },
  },
  attachments: {
    select: {
      id: true,
      taskId: true,
      fileName: true,
      fileUrl: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
};

const detailSelect = {
  ...defaultSelect,
  recreatedTask: {
    select: {
      id: true,
      code: true,
      title: true,
      assignment: {
        select: {
          intern: { select: { fullName: true } },
        },
      },
    },
  },
  dependsOn: {
    select: { id: true, code: true, title: true },
  },
  dependencies: {
    select: { id: true, code: true, title: true },
  },
};

export class TaskRepository {
  async findAll(
    query: TaskQueryDto,
    scope?: {
      internId?: string;
      departmentIds?: string[];
      leaderScope?: {
        departmentIds: string[];
        leaderUserId: string;
      };
    },
  ) {
    const {
      title,
      code,
      owner,
      priority,
      createdBy,
      phase,
      module,
      deadlineFrom,
      deadlineTo,
      taskGroupId,
      status,
      statusNot,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    let deadlineCondition: Prisma.DateTimeFilter | undefined;
    if (deadlineFrom || deadlineTo) {
      const from = deadlineFrom ? new Date(deadlineFrom) : undefined;
      const to = deadlineTo ? new Date(deadlineTo) : undefined;
      const validFrom = from && !isNaN(from.getTime()) ? from : undefined;
      const validTo = to && !isNaN(to.getTime()) ? to : undefined;

      if (validFrom || validTo) {
        deadlineCondition = {
          ...(validFrom ? { gte: validFrom } : {}),
          ...(validTo ? { lte: validTo } : {}),
        };
      }
    }

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(title ? { title: { contains: title, mode: "insensitive" } } : {}),
      ...(code ? { code: { contains: code, mode: "insensitive" } } : {}),
      ...(owner
        ? {
            assignment: {
              intern: {
                OR: [
                  { fullName: { contains: owner, mode: "insensitive" } },
                  { user: { email: { contains: owner, mode: "insensitive" } } },
                ],
              },
            },
          }
        : {}),
      ...(priority ? { priority } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(phase ? { phase: { contains: phase, mode: "insensitive" } } : {}),
      ...(module ? { module: { contains: module, mode: "insensitive" } } : {}),
      ...(taskGroupId ? { taskGroupId } : {}),
      ...(status ? { assignment: { status } } : {}),
      ...(statusNot ? { NOT: { assignment: { status: statusNot } } } : {}),
      ...(deadlineCondition ? { deadline: deadlineCondition } : {}),
      ...(scope?.internId !== undefined
        ? {
            assignment: {
              OR: [
                { internId: scope.internId },
                { supportId: scope.internId },
              ],
            },
          }
        : {}),
      ...(scope?.leaderScope
        ? {
            OR: [
              ...(scope.leaderScope.departmentIds.length > 0
                ? [{ taskGroup: { departmentId: { in: scope.leaderScope.departmentIds } } }]
                : []),
              { createdBy: scope.leaderScope.leaderUserId },
              { assignment: { intern: { leaderId: scope.leaderScope.leaderUserId } } },
              { assignment: { support: { leaderId: scope.leaderScope.leaderUserId } } },
              { taskGroup: { members: { some: { intern: { leaderId: scope.leaderScope.leaderUserId } } } } },
            ],
          }
        : scope?.departmentIds !== undefined
        ? {
            OR: [
              { taskGroup: { departmentId: { in: scope.departmentIds } } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const SORT_MAP: Record<string, Prisma.TaskOrderByWithRelationInput> = {
      createdAt: { createdAt: order },
      deadline: { deadline: order },
      title: { title: order },
      priority: { priority: order },
      code: { code: order },
    };
    const orderBy = SORT_MAP[sortBy] ?? { createdAt: order };

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: defaultSelect,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: detailSelect,
    });
  }

  findByCode(code: string, taskGroupId: string | null = null) {
    return prisma.task.findFirst({
      where: { code, taskGroupId, deletedAt: null },
      select: detailSelect,
    });
  }

  create(data: CreateTaskDto, createdBy: string) {
    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        priority: data.priority,
        code: data.code,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        estDays: data.estDays,
        phase: data.phase,
        module: data.module,
        acceptanceCriteria: data.acceptanceCriteria,
        taskNotes: data.taskNotes,
        taskGroupId: data.taskGroupId,
        createdBy,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateTaskDto) {
    return prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.deadline !== undefined ? { deadline: new Date(data.deadline) } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate) : null }
          : {}),
        ...(data.estDays !== undefined ? { estDays: data.estDays } : {}),
        ...(data.phase !== undefined ? { phase: data.phase } : {}),
        ...(data.module !== undefined ? { module: data.module } : {}),
        ...(data.acceptanceCriteria !== undefined
          ? { acceptanceCriteria: data.acceptanceCriteria }
          : {}),
        ...(data.taskNotes !== undefined ? { taskNotes: data.taskNotes } : {}),
        ...(data.taskGroupId !== undefined ? { taskGroupId: data.taskGroupId } : {}),
        ...(data.recreatedTaskId !== undefined
          ? { recreatedTaskId: data.recreatedTaskId }
          : {}),
      },
      select: defaultSelect,
    });
  }

  softDelete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: defaultSelect,
    });
  }

  // ─── Attachments ────────────────────────────────────────────────────────────

  findAttachmentById(id: string) {
    return prisma.taskAttachment.findUnique({
      where: { id },
    });
  }

  findAttachmentsByTaskId(taskId: string) {
    return prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
  }

  createAttachment(
    taskId: string,
    data: ConfirmAttachmentUploadDto,
    fileUrl: string,
    uploadedBy: string,
  ) {
    return prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: data.fileName,
        fileUrl,
        filePath: data.filePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        uploadedBy,
      },
    });
  }

  createLinkAttachment(
    taskId: string,
    data: CreateLinkAttachmentDto,
    uploadedBy: string,
  ) {
    return prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        filePath: `external:${data.fileUrl}`,
        mimeType: "text/uri-list",
        fileSize: 0,
        uploadedBy,
      },
    });
  }

  deleteAttachment(id: string) {
    return prisma.taskAttachment.delete({
      where: { id },
    });
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────────

  createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return activityLogRepository.create(data);
  }
}

export const taskRepository = new TaskRepository();
