import { Prisma, AssignmentStatus, ExtensionRequestStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  QueryExtensionRequestsDto,
} from "./task-assignment.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

const extensionRequestSelect = {
  id: true,
  assignmentId: true,
  internId: true,
  currentDeadline: true,
  proposedDeadline: true,
  extensionDays: true,
  reason: true,
  commitmentPlan: true,
  status: true,
  rejectionReason: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  intern: {
    select: {
      id: true,
      fullName: true,
      internCode: true,
      department: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
    },
  },
  reviewer: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  assignment: {
    select: {
      id: true,
      taskId: true,
      status: true,
      task: {
        select: {
          id: true,
          code: true,
          title: true,
          deadline: true,
        },
      },
    },
  },
};

const defaultSelect = {
  id: true,
  taskId: true,
  internId: true,
  assignedBy: true,
  supportId: true,
  status: true,
  blockedReason: true,
  startedAt: true,
  completedAt: true,
  assignedAt: true,
  updatedAt: true,
  task: {
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      deadline: true,
      estDays: true,
      priority: true,
      createdBy: true,
      taskGroupId: true,
      createdAt: true,
      updatedAt: true,
      taskGroup: {
        select: { id: true, name: true, departmentId: true },
      },
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
  assigner: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  support: {
    select: {
      id: true,
      userId: true,
      leaderId: true,
      fullName: true,
      status: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  },
  extensionRequests: {
    select: {
      id: true,
      currentDeadline: true,
      proposedDeadline: true,
      extensionDays: true,
      reason: true,
      commitmentPlan: true,
      status: true,
      rejectionReason: true,
      reviewedBy: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export class TaskAssignmentRepository {
  async findAll(
    query: TaskAssignmentQueryDto,
    scope?: {
      internId?: string;
      departmentIds?: string[];
      leaderUserId?: string;
    },
  ) {
    const {
      taskId,
      internId,
      assignedBy,
      leaderId,
      status,
      sortBy = "assignedAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.TaskAssignmentWhereInput = {
      task: { deletedAt: null },
      ...(taskId ? { taskId } : {}),
      ...(internId ? { internId } : {}),
      ...(assignedBy ? { assignedBy } : {}),
      ...(status ? { status } : {}),
      ...(leaderId
        ? {
            intern: { leaderId },
          }
        : {}),
      ...(scope?.internId !== undefined
        ? {
            OR: [
              { internId: scope.internId },
              { supportId: scope.internId },
            ],
          }
        : {}),
      ...(scope?.departmentIds !== undefined && scope?.leaderUserId !== undefined
        ? {
            OR: [
              { assignedBy: scope.leaderUserId },
              { intern: { leaderId: scope.leaderUserId } },
              { task: { taskGroup: { departmentId: { in: scope.departmentIds } } } },
              { intern: { departmentId: { in: scope.departmentIds } } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.taskAssignment.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.taskAssignment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.taskAssignment.findUnique({
      where: { id },
      select: defaultSelect,
    });
  }

  findByTaskId(taskId: string) {
    return prisma.taskAssignment.findUnique({
      where: { taskId },
      select: defaultSelect,
    });
  }

  create(data: CreateTaskAssignmentDto, assignedBy: string, status: AssignmentStatus) {
    return prisma.taskAssignment.create({
      data: {
        taskId: data.taskId,
        internId: data.internId,
        supportId: data.supportId || null,
        assignedBy,
        status,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateTaskAssignmentDto) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.blockedReason !== undefined ? { blockedReason: data.blockedReason } : {}),
        ...(data.internId !== undefined ? { internId: data.internId } : {}),
        ...(data.supportId !== undefined ? { supportId: data.supportId } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.taskAssignment.delete({
      where: { id },
    });
  }

  // ─── Task Extension Request Methods ──────────────────────────────────────────

  createExtensionRequest(data: {
    assignmentId: string;
    internId: string;
    currentDeadline: Date;
    proposedDeadline: Date;
    extensionDays: number;
    reason: string;
    commitmentPlan: string;
  }) {
    return prisma.taskExtensionRequest.create({
      data: {
        assignmentId: data.assignmentId,
        internId: data.internId,
        currentDeadline: data.currentDeadline,
        proposedDeadline: data.proposedDeadline,
        extensionDays: data.extensionDays,
        reason: data.reason,
        commitmentPlan: data.commitmentPlan,
        status: ExtensionRequestStatus.PENDING,
      },
      select: extensionRequestSelect,
    });
  }

  findExtensionRequestById(id: string) {
    return prisma.taskExtensionRequest.findUnique({
      where: { id },
      select: extensionRequestSelect,
    });
  }

  findPendingExtensionRequestByAssignmentId(assignmentId: string) {
    return prisma.taskExtensionRequest.findFirst({
      where: {
        assignmentId,
        status: ExtensionRequestStatus.PENDING,
      },
      select: extensionRequestSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async findExtensionRequests(
    query: QueryExtensionRequestsDto,
    scope?: {
      internId?: string;
      leaderUserId?: string;
    },
  ) {
    const { status, internId, assignmentId, taskId, page = 1, limit = 20 } = query;
    const where: Prisma.TaskExtensionRequestWhereInput = {};

    if (status) where.status = status;
    if (internId) where.internId = internId;
    if (assignmentId) where.assignmentId = assignmentId;
    if (taskId) where.assignment = { taskId };

    if (scope?.internId) {
      where.internId = scope.internId;
    } else if (scope?.leaderUserId) {
      where.intern = { leaderId: scope.leaderUserId };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.taskExtensionRequest.findMany({
        where,
        select: extensionRequestSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.taskExtensionRequest.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  findExtensionRequestsByAssignment(assignmentId: string) {
    return prisma.taskExtensionRequest.findMany({
      where: { assignmentId },
      select: extensionRequestSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  countExtensionRequestsByAssignment(assignmentId: string) {
    return prisma.taskExtensionRequest.count({
      where: { assignmentId },
    });
  }

  countExtensionRequestsByIntern(internId: string) {
    return prisma.taskExtensionRequest.count({
      where: { internId },
    });
  }

  updateExtensionRequest(
    id: string,
    data: {
      status?: ExtensionRequestStatus;
      rejectionReason?: string | null;
      reviewedBy?: string;
      reviewedAt?: Date;
    },
  ) {
    return prisma.taskExtensionRequest.update({
      where: { id },
      data,
      select: extensionRequestSelect,
    });
  }

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
