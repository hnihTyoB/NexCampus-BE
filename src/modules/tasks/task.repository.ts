import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from './task.dto';

const creatorSelect = {
  id: true,
  email: true,
  fullName: true,
};

const defaultInclude = {
  creator: { select: creatorSelect },
  assignment: true,
  attachments: {
    orderBy: { createdAt: 'desc' as const },
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
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(title ? { title: { contains: title, mode: 'insensitive' } } : {}),
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
        include: defaultInclude,
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
      include: defaultInclude,
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
      include: defaultInclude,
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
      },
      include: defaultInclude,
    });
  }

  softDelete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: defaultInclude,
    });
  }
}
