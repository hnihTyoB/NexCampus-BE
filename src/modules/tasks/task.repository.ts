import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from "./task.dto";

const creatorSelect = {
  id: true,
  email: true,
  fullName: true,
};

const defaultSelect = {
  id: true,
  title: true,
  description: true,
  deadline: true,
  priority: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: creatorSelect },
  assignment: {
    select: {
      id: true,
      taskId: true,
      internId: true,
      assignedBy: true,
      status: true,
      assignedAt: true,
      updatedAt: true,
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
    orderBy: {
      createdAt: "desc" as const,
    },
  },
};

export class TaskRepository {
  async findAll(query: TaskQueryDto) {
    const {
      title,
      priority,
      createdBy,
      deadlineFrom,
      deadlineTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(title ? { title: { contains: title, mode: "insensitive" } } : {}),
      ...(priority ? { priority } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(deadlineFrom || deadlineTo
        ? {
            deadline: {
              ...(deadlineFrom ? { gte: new Date(deadlineFrom) } : {}),
              ...(deadlineTo ? { lte: new Date(deadlineTo) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
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
      select: defaultSelect,
    });
  }

  create(data: CreateTaskDto, createdBy: string) {
    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        priority: data.priority,
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
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.deadline !== undefined
          ? { deadline: new Date(data.deadline) }
          : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
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
}
