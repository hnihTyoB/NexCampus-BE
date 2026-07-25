import { prisma } from "../../database/prisma.client";
import { CreateTaskGroupDto, UpdateTaskGroupDto } from "./task-group.dto";

const defaultSelect = {
  id: true,
  name: true,
  description: true,
  _count: { select: { tasks: true } },
  createdAt: true,
  updatedAt: true,
};

export class TaskGroupRepository {
  findAll() {
    return prisma.taskGroup.findMany({
      select: defaultSelect,
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return prisma.taskGroup.findUnique({
      where: { id },
      select: defaultSelect,
    });
  }

  create(data: CreateTaskGroupDto) {
    return prisma.taskGroup.create({
      data: {
        name: data.name,
        description: data.description,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateTaskGroupDto) {
    return prisma.taskGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.taskGroup.delete({ where: { id } });
  }
}
