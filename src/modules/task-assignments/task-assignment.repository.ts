import { Prisma, AssignmentStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
} from "./task-assignment.dto";

const defaultSelect = {
  id: true,
  taskId: true,
  internId: true,
  assignedBy: true,
  supportId: true,
  status: true,
  blockedReason: true,
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

  createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Prisma.InputJsonValue;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details,
        ipAddress: data.ipAddress,
      },
    });
  }
}
