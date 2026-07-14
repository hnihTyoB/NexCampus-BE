import { prisma } from "../../database/prisma.client";
import { TaskAnalyticsDto } from "./task.dto";

export class TaskAnalyticsService {
  /**
   * Tổng hợp chỉ số tổng quan:
   * - Tổng số task
   * - Phân phối theo trạng thái phân công (TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED)
   * - Phân phối theo độ ưu tiên (HIGH/P0, MEDIUM/P1, LOW/P2)
   */
  private async getOverview(taskGroupId?: string) {
    const taskWhere: any = { deletedAt: null };
    if (taskGroupId) {
      taskWhere.taskGroupId = taskGroupId;
    }

    const assignmentWhere: any = {
      task: { deletedAt: null },
      intern: { deletedAt: null },
    };
    if (taskGroupId) {
      assignmentWhere.task = {
        deletedAt: null,
        taskGroupId: taskGroupId,
      };
    }

    const [totalTasks, statusGroups, priorityGroups] = await Promise.all([
      prisma.task.count({ where: taskWhere }),

      // Đếm số task theo status của TaskAssignment
      // Task chưa được gán sẽ không xuất hiện trong phân phối này
      prisma.taskAssignment.groupBy({
        by: ["status"],
        where: assignmentWhere,
        _count: { id: true },
        orderBy: { status: "asc" },
      }),

      // Đếm số task theo priority của Task
      prisma.task.groupBy({
        by: ["priority"],
        where: taskWhere,
        _count: { id: true },
        orderBy: { priority: "asc" },
      }),
    ]);

    return {
      totalTasks,
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

  /**
   * Thống kê tải công việc theo Intern:
   * - Tổng số task được giao
   * - Tổng số ngày công ước lượng (estDays)
   * - Phân phối theo trạng thái
   *
   * Đây là dữ liệu cốt lõi để AI Allocation sau này tính toán
   * Workload Cap và tránh overload một intern.
   */
  private async getWorkloadByIntern(taskGroupId?: string) {
    const where: any = {
      task: { deletedAt: null },
      intern: { deletedAt: null },
    };
    if (taskGroupId) {
      where.task = {
        deletedAt: null,
        taskGroupId: taskGroupId,
      };
    }

    // Lấy tất cả assignments với đầy đủ thông tin
    const assignments = await prisma.taskAssignment.findMany({
      where,
      select: {
        status: true,
        intern: {
          select: {
            id: true,
            fullName: true,
          },
        },
        task: {
          select: {
            estDays: true,
          },
        },
      },
    });

    // Group by internId trong application layer
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
      totalEstDays: Math.round(entry.totalEstDays * 100) / 100, // làm tròn 2 chữ số
      byStatus: Array.from(entry.statusCount.entries()).map(
        ([status, count]) => ({ status, count }),
      ),
    }));
  }

  /**
   * Thống kê tiến độ theo Phase:
   * - Tổng số task trong phase
   * - Số task đã Done
   * - Tỉ lệ hoàn thành (0.0 - 1.0)
   *
   * Chỉ tính các task có trường phase (được import từ Excel).
   * Phục vụ biểu đồ Timeline Roadmap trên Dashboard.
   */
  private async getProgressByPhase(taskGroupId?: string) {
    const where: any = {
      deletedAt: null,
      phase: { not: null },
    };
    if (taskGroupId) {
      where.taskGroupId = taskGroupId;
    }

    // Lấy tất cả task có phase
    const tasks = await prisma.task.findMany({
      where,
      select: {
        phase: true,
        assignment: {
          select: { status: true },
        },
      },
    });

    // Group by phase
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

      if (task.assignment?.status === "DONE") {
        entry.doneTasks++;
      }
    }

    // Sắp xếp theo tên phase
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

  /**
   * Tổng hợp toàn bộ analytics vào một response duy nhất.
   */
  async getAll(taskGroupId?: string): Promise<TaskAnalyticsDto> {
    const [overview, workloadByIntern, progressByPhase] = await Promise.all([
      this.getOverview(taskGroupId),
      this.getWorkloadByIntern(taskGroupId),
      this.getProgressByPhase(taskGroupId),
    ]);

    return { overview, workloadByIntern, progressByPhase };
  }
}
