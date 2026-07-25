import { prisma } from "../../database/prisma.client";
import { TaskAnalyticsDto } from "./task.dto";
import { ASSIGNMENT_STATUS } from "../../common/constants/status.constant";

function buildDateFilter(dateFrom?: string, dateTo?: string) {
  const filter: any = {};
  if (dateFrom) {
    filter.gte = new Date(dateFrom);
  }
  if (dateTo) {
    filter.lte = new Date(dateTo);
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

export class TaskAnalyticsService {
  private async getOverview(taskGroupId?: string, dateFrom?: string, dateTo?: string) {
    const createdAt = buildDateFilter(dateFrom, dateTo);

    const taskWhere: any = { deletedAt: null };
    if (taskGroupId) taskWhere.taskGroupId = taskGroupId;
    if (createdAt) taskWhere.createdAt = createdAt;

    const assignmentWhere: any = {
      task: { deletedAt: null },
      intern: { deletedAt: null },
    };
    if (taskGroupId) {
      assignmentWhere.task = { deletedAt: null, taskGroupId: taskGroupId };
    }
    if (createdAt) {
      assignmentWhere.task = { ...assignmentWhere.task, createdAt };
    }

    // Overdue: deadline < now AND not done (assignment status != DONE)
    const overdueWhere: any = {
      deletedAt: null,
      deadline: { lt: new Date() },
    };
    if (taskGroupId) overdueWhere.taskGroupId = taskGroupId;
    if (createdAt) overdueWhere.createdAt = createdAt;
    // Exclude tasks that are already done
    overdueWhere.NOT = { assignment: { status: "DONE" } };

    const [totalTasks, overdueTasks, statusGroups, priorityGroups] =
      await Promise.all([
        prisma.task.count({ where: taskWhere }),
        prisma.task.count({ where: overdueWhere }),
        prisma.taskAssignment.groupBy({
          by: ["status"],
          where: assignmentWhere,
          _count: { id: true },
          orderBy: { status: "asc" },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: taskWhere,
          _count: { id: true },
          orderBy: { priority: "asc" },
        }),
      ]);

    return {
      totalTasks,
      overdueTasks,
      byStatus: statusGroups.map((g) => ({
        status: g.status,
        count: g._count.id,
      })),
      byPriority: priorityGroups.map((g) => ({
        priority: g.priority,
        count: g._count.id,
      })),
    };
  }

  private async getWorkloadByIntern(
    taskGroupId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const createdAt = buildDateFilter(dateFrom, dateTo);

    const where: any = {
      task: { deletedAt: null },
      intern: { deletedAt: null },
    };
    if (taskGroupId) {
      where.task = { deletedAt: null, taskGroupId: taskGroupId };
    }
    if (createdAt) {
      where.task = { ...where.task, createdAt };
    }

    const assignments = await prisma.taskAssignment.findMany({
      where,
      select: {
        status: true,
        intern: { select: { id: true, fullName: true } },
        task: { select: { estDays: true } },
      },
    });

    const internMap = new Map<
      string,
      {
        internId: string;
        internFullName: string;
        totalTasks: number;
        totalEstDays: number;
        statusCount: Map<string, number>;
      }
    >();

    for (const a of assignments) {
      const key = a.intern.id;
      if (!internMap.has(key)) {
        internMap.set(key, {
          internId: a.intern.id,
          internFullName: a.intern.fullName,
          totalTasks: 0,
          totalEstDays: 0,
          statusCount: new Map(),
        });
      }
      const entry = internMap.get(key)!;
      entry.totalTasks++;
      entry.totalEstDays += a.task.estDays ?? 0;
      entry.statusCount.set(
        a.status,
        (entry.statusCount.get(a.status) ?? 0) + 1,
      );
    }

    return Array.from(internMap.values()).map((entry) => ({
      internId: entry.internId,
      internFullName: entry.internFullName,
      totalTasks: entry.totalTasks,
      totalEstDays: Math.round(entry.totalEstDays * 100) / 100,
      byStatus: Array.from(entry.statusCount.entries()).map(
        ([status, count]) => ({ status, count }),
      ),
    }));
  }

  private async getProgressByPhase(
    taskGroupId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const createdAt = buildDateFilter(dateFrom, dateTo);

    const where: any = { deletedAt: null, phase: { not: null } };
    if (taskGroupId) where.taskGroupId = taskGroupId;
    if (createdAt) where.createdAt = createdAt;

    const tasks = await prisma.task.findMany({
      where,
      select: {
        phase: true,
        assignment: { select: { status: true } },
      },
    });

    const phaseMap = new Map<
      string,
      { totalTasks: number; doneTasks: number }
    >();

    for (const task of tasks) {
      const phase = task.phase!;
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, { totalTasks: 0, doneTasks: 0 });
      }
      const entry = phaseMap.get(phase)!;
      entry.totalTasks++;
      if (task.assignment?.status === ASSIGNMENT_STATUS.DONE) {
        entry.doneTasks++;
      }
    }

    return Array.from(phaseMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([phase, data]) => ({
        phase,
        totalTasks: data.totalTasks,
        doneTasks: data.doneTasks,
        completionRate:
          data.totalTasks > 0
            ? Math.round((data.doneTasks / data.totalTasks) * 10000) / 10000
            : 0,
      }));
  }

  async getAll(
    taskGroupId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<TaskAnalyticsDto> {
    const [overview, workloadByIntern, progressByPhase] = await Promise.all([
      this.getOverview(taskGroupId, dateFrom, dateTo),
      this.getWorkloadByIntern(taskGroupId, dateFrom, dateTo),
      this.getProgressByPhase(taskGroupId, dateFrom, dateTo),
    ]);

    return { overview, workloadByIntern, progressByPhase };
  }
}
