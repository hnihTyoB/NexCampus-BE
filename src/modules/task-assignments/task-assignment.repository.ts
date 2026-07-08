import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
} from "./task-assignment.dto";

const defaultInclude = {
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
        include: defaultInclude,
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
      include: defaultInclude,
    });
  }

  findByTaskId(taskId: string) {
    return prisma.taskAssignment.findFirst({
      where: {
        taskId,
        task: { deletedAt: null },
        intern: { deletedAt: null },
      },
      include: defaultInclude,
    });
  }

  create(data: CreateTaskAssignmentDto, assignedBy: string) {
    return prisma.taskAssignment.create({
      data: {
        taskId: data.taskId,
        internId: data.internId,
        assignedBy,
      },
      include: defaultInclude,
    });
  }

  update(id: string, data: UpdateTaskAssignmentDto) {
    return prisma.taskAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.internId !== undefined ? { internId: data.internId } : {}),
      },
      include: defaultInclude,
    });
  }

  delete(id: string) {
    return prisma.taskAssignment.delete({
      where: { id },
    });
  }
}
