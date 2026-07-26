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
    select: { id: true, name: true },
  },
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
      intern: { select: { id: true, fullName: true } },
    },
  },
  recreatedTaskId: true,
  recreatedTask: {
    select: {
      id: true, title: true, code: true,
      assignment: {
        select: { intern: { select: { fullName: true } } },
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
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  // Dependencies: các task mà task này phụ thuộc vào
  dependsOn: {
    select: { id: true, code: true, title: true },
  },
  // Tasks phụ thuộc vào task này
  dependencies: {
    select: { id: true, code: true, title: true },
  },
};

export class TaskRepository {
  async findAll(query: TaskQueryDto) {
    const {
      title,
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

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(title ? { title: { contains: title, mode: "insensitive" } } : {}),
      ...(priority ? { priority } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(phase ? { phase: { contains: phase, mode: "insensitive" } } : {}),
      ...(module ? { module: { contains: module, mode: "insensitive" } } : {}),
      ...(taskGroupId ? { taskGroupId } : {}),
      ...(status ? { assignment: { status: status as any } } : {}),
      ...(statusNot ? { NOT: { assignment: { status: statusNot as any } } } : {}),
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

  findByCode(code: string, taskGroupId: string | null = null) {
    return prisma.task.findFirst({
      where: { code, taskGroupId, deletedAt: null },
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
}
