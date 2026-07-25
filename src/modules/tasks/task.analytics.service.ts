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
      OR: [
        { internId: null },
        { intern: { deletedAt: null } }
      ]
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
    let queryConditions = `t.deleted_at IS NULL AND i.deleted_at IS NULL`;
    const queryParams: any[] = [];

    if (taskGroupId) {
      queryParams.push(taskGroupId);
      queryConditions += ` AND t.task_group_id = $${queryParams.length}::uuid`;
    }

    if (dateFrom) {
      queryParams.push(new Date(dateFrom));
      queryConditions += ` AND t.created_at >= $${queryParams.length}::timestamp`;
    }

    if (dateTo) {
      queryParams.push(new Date(dateTo));
      queryConditions += ` AND t.created_at <= $${queryParams.length}::timestamp`;
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        i.id AS "internId",
        i.full_name AS "internFullName",
        ta.status AS "status",
        COUNT(ta.id)::int AS "statusCount",
        COALESCE(SUM(t.est_days), 0)::float AS "groupEstDays"
      FROM task_assignments ta
      INNER JOIN interns i ON ta.intern_id = i.id
      INNER JOIN tasks t ON ta.task_id = t.id
      WHERE ${queryConditions}
      GROUP BY i.id, i.full_name, ta.status
      ORDER BY i.full_name ASC
      `,
      ...queryParams,
    );

    const internMap = new Map<
      string,
      {
        internId: string;
        internFullName: string;
        totalTasks: number;
        totalEstDays: number;
        byStatus: { status: string; count: number }[];
      }
    >();

    for (const r of rows) {
      const key = r.internId;
      if (!internMap.has(key)) {
        internMap.set(key, {
          internId: r.internId,
          internFullName: r.internFullName,
          totalTasks: 0,
          totalEstDays: 0,
          byStatus: [],
        });
      }
      const entry = internMap.get(key)!;
      entry.totalTasks += r.statusCount;
      entry.totalEstDays += r.groupEstDays;
      entry.byStatus.push({
        status: r.status,
        count: r.statusCount,
      });
    }

    return Array.from(internMap.values()).map((entry) => ({
      internId: entry.internId,
      internFullName: entry.internFullName,
      totalTasks: entry.totalTasks,
      totalEstDays: Math.round(entry.totalEstDays * 100) / 100,
      byStatus: entry.byStatus,
    }));
  }

  private async getProgressByPhase(
    taskGroupId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    let queryConditions = `t.deleted_at IS NULL AND t.phase IS NOT NULL`;
    const queryParams: any[] = [];

    if (taskGroupId) {
      queryParams.push(taskGroupId);
      queryConditions += ` AND t.task_group_id = $${queryParams.length}::uuid`;
    }

    if (dateFrom) {
      queryParams.push(new Date(dateFrom));
      queryConditions += ` AND t.created_at >= $${queryParams.length}::timestamp`;
    }

    if (dateTo) {
      queryParams.push(new Date(dateTo));
      queryConditions += ` AND t.created_at <= $${queryParams.length}::timestamp`;
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        t.phase AS "phase",
        COUNT(t.id)::int AS "totalTasks",
        COUNT(CASE WHEN ta.status = 'DONE' THEN 1 END)::int AS "doneTasks"
      FROM tasks t
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      WHERE ${queryConditions}
      GROUP BY t.phase
      ORDER BY t.phase ASC
      `,
      ...queryParams,
    );

    return rows.map((r) => ({
      phase: r.phase,
      totalTasks: r.totalTasks,
      doneTasks: r.doneTasks,
      completionRate:
        r.totalTasks > 0
          ? Math.round((r.doneTasks / r.totalTasks) * 10000) / 10000
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
