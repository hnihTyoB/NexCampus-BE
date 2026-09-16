import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  CreateTaskGroupDto,
  UpdateTaskGroupDto,
  TaskGroupQueryDto,
  TaskGroupProgressDto,
} from "./task-group.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

const defaultSelect = {
  id: true,
  name: true,
  description: true,
  departmentId: true,
  status: true,
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
  async findAll(
    query: TaskGroupQueryDto,
    scope?: {
      departmentIds?: string[];
      internId?: string;
    },
  ) {
    const { departmentId, status, search, page = 1, limit = 20 } = query;

    const where: Prisma.TaskGroupWhereInput = {
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(scope?.departmentIds !== undefined
        ? {
            OR: [
              { departmentId: { in: scope.departmentIds } },
              { departmentId: null },
            ],
          }
        : {}),
      ...(scope?.internId !== undefined
        ? {
            members: {
              some: { internId: scope.internId },
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.taskGroup.findMany({
        where,
        select: defaultSelect,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.taskGroup.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  findById(id: string) {
    return prisma.taskGroup.findUnique({
      where: { id },
      select: defaultSelect,
    });
  }

  findByNameAndDepartment(name: string, departmentId: string | null = null) {
    return prisma.taskGroup.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        departmentId: departmentId ?? null,
      },
      select: { id: true, name: true, departmentId: true },
    });
  }

  create(data: CreateTaskGroupDto) {
    return prisma.taskGroup.create({
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId || null,
        status: data.status,
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
        ...(data.status !== undefined ? { status: data.status } : {}),
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

  async getProgress(id: string): Promise<TaskGroupProgressDto> {
    const group = await prisma.taskGroup.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        tasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            assignment: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!group) {
      return {
        taskGroupId: id,
        taskGroupName: "",
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        reviewTasks: 0,
        todoTasks: 0,
        blockedTasks: 0,
        unassignedTasks: 0,
        completionRate: 0,
      };
    }

    const totalTasks = group.tasks.length;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let reviewTasks = 0;
    let todoTasks = 0;
    let blockedTasks = 0;
    let unassignedTasks = 0;

    for (const task of group.tasks) {
      if (!task.assignment) {
        unassignedTasks++;
      } else {
        switch (task.assignment.status) {
          case "DONE":
            completedTasks++;
            break;
          case "IN_PROGRESS":
            inProgressTasks++;
            break;
          case "REVIEW":
            reviewTasks++;
            break;
          case "TODO":
          case "PENDING_APPROVAL":
            todoTasks++;
            break;
          case "BLOCKED":
            blockedTasks++;
            break;
        }
      }
    }

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      taskGroupId: group.id,
      taskGroupName: group.name,
      totalTasks,
      completedTasks,
      inProgressTasks,
      reviewTasks,
      todoTasks,
      blockedTasks,
      unassignedTasks,
      completionRate,
    };
  }

  findTasks(id: string) {
    return prisma.task.findMany({
      where: { taskGroupId: id, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        deadline: true,
        startDate: true,
        estDays: true,
        phase: true,
        module: true,
        priority: true,
        createdBy: true,
        createdAt: true,
        assignment: {
          select: {
            id: true,
            status: true,
            internId: true,
            supportId: true,
            intern: { select: { id: true, fullName: true } },
            support: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
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
