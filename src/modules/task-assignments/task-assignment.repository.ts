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
      createdAt: true,
      updatedAt: true,
      recreatedTaskId: true,
      recreatedTask: {
        select: {
          id: true, title: true, code: true,
          assignment: {
            select: { intern: { select: { fullName: true } } },
          },
        },
      },
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
      fullName: true,
    },
  },
};

export class TaskAssignmentRepository {
  async findAll(query: TaskAssignmentQueryDto) {
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
      intern: { deletedAt: null },
      ...(taskId ? { taskId } : {}),
      ...(internId ? { internId } : {}),
      ...(assignedBy ? { assignedBy } : {}),
      ...(leaderId ? { intern: { leaderId } } : {}),
      ...(status ? { status } : {}),
    };

    const skip = (page - 1) * limit;

    const orderByList = sortBy === "assignedAt"
      ? [
          { assignedAt: order },
          { task: { createdAt: order } }
        ]
      : [{ [sortBy]: order }];

    const [data, total] = await prisma.$transaction([
      prisma.taskAssignment.findMany({
        where,
        select: defaultSelect,
        orderBy: orderByList,
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
    return prisma.taskAssignment.findFirst({
      where: {
        id,
        task: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  findByTaskId(taskId: string) {
    return prisma.taskAssignment.findFirst({
      where: {
        taskId,
        task: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  create(data: CreateTaskAssignmentDto, assignedBy: string, status?: AssignmentStatus) {
    return prisma.taskAssignment.create({
      data: {
        taskId: data.taskId,
        internId: data.internId,
        assignedBy,
        ...(status ? { status } : {}),
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateTaskAssignmentDto) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.status === AssignmentStatus.BLOCKED
          ? { blockedReason: data.blockedReason }
          : data.status !== undefined
            ? { blockedReason: null }
            : {}),
        ...(data.internId !== undefined ? { internId: data.internId } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.taskAssignment.delete({
      where: { id },
    });
  }
}
