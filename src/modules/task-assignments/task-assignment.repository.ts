import { Prisma } from "@prisma/client";
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
      department: true,
      position: true,
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
};

export class TaskAssignmentRepository {
  async findAll(query: TaskAssignmentQueryDto) {
    const {
      taskId,
      internId,
      assignedBy,
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
      ...(status ? { status } : {}),
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
    return prisma.taskAssignment.findFirst({
      where: {
        id,
        task: { deletedAt: null },
        intern: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  findByTaskId(taskId: string) {
    return prisma.taskAssignment.findFirst({
      where: {
        taskId,
        task: { deletedAt: null },
        intern: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  create(data: CreateTaskAssignmentDto, assignedBy: string) {
    return prisma.taskAssignment.create({
      data: {
        taskId: data.taskId,
        internId: data.internId,
        assignedBy,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateTaskAssignmentDto) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
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
