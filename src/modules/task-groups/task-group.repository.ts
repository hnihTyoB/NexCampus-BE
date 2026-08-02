import { prisma } from "../../database/prisma.client";
import { CreateTaskGroupDto, UpdateTaskGroupDto } from "./task-group.dto";

const defaultSelect = {
  id: true,
  name: true,
  description: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  maxWorkloadDays: true,
  maxActiveTasks: true,
  requireAllMembers: true,
  members: {
    orderBy: { intern: { fullName: "asc" as const } },
    select: {
      internId: true,
      intern: {
        select: {
          id: true,
          leaderId: true,
          fullName: true,
          status: true,
          user: { select: { email: true } },
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
        },
      },
    },
  },
  _count: { select: { tasks: true, members: true } },
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
        departmentId: data.departmentId || null,
        maxWorkloadDays: data.maxWorkloadDays ?? 10,
        maxActiveTasks: data.maxActiveTasks ?? null,
        requireAllMembers: data.requireAllMembers ?? false,
        ...(data.memberIds && data.memberIds.length > 0
          ? {
              members: {
                create: data.memberIds.map((internId) => ({ internId })),
              },
            }
          : {}),
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
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
        ...(data.maxWorkloadDays !== undefined
          ? { maxWorkloadDays: data.maxWorkloadDays }
          : {}),
        ...(data.maxActiveTasks !== undefined
          ? { maxActiveTasks: data.maxActiveTasks }
          : {}),
        ...(data.requireAllMembers !== undefined
          ? { requireAllMembers: data.requireAllMembers }
          : {}),
        ...(data.memberIds !== undefined
          ? {
              members: {
                deleteMany: {},
                create: data.memberIds.map((internId) => ({ internId })),
              },
            }
          : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.taskGroup.delete({ where: { id } });
  }
}
