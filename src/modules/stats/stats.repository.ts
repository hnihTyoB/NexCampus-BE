import { prisma } from "../../database/prisma.client";
import {
  AdminStatsResponseDto,
  LeaderStatsResponseDto,
  InternStatsResponseDto,
  DepartmentDistributionDto,
  LeaderTeamProgressDto,
  RecentActivityDto,
  LeaderInternProgressDto,
  RecentTaskItemDto,
  ReworkSubmissionDto,
} from "./stats.dto";

export class StatsRepository {
  /**
   * Helper tính toán khoảng thời gian trong ngày theo UTC+7 (Asia/Ho_Chi_Minh)
   */
  private getVietnamDayRange(date = new Date()): { startOfDay: Date; endOfDay: Date } {
    const vnDateStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD
    const startOfDay = new Date(`${vnDateStr}T00:00:00.000+07:00`);
    const endOfDay = new Date(`${vnDateStr}T23:59:59.999+07:00`);
    return { startOfDay, endOfDay };
  }

  /**
   * Helper tính toán khoảng thời gian đầu tuần (Thứ 2) đến cuối tuần (Chủ nhật)
   */
  private getVietnamWeekRange(date = new Date()): { startOfWeek: Date; endOfWeek: Date } {
    const { startOfDay } = this.getVietnamDayRange(date);
    // getDay: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const day = startOfDay.getUTCDay(); // Lưu ý UTC vs Local, dùng VN day:
    const vnDay = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getDay();
    const diffToMonday = vnDay === 0 ? -6 : 1 - vnDay;
    
    const startOfWeek = new Date(startOfDay.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return { startOfWeek, endOfWeek };
  }

  /**
   * Thống kê toàn hệ thống dành cho Admin
   */
  async getAdminStats(): Promise<AdminStatsResponseDto> {
    const now = new Date();

    const [
      activeInterns,
      completedInterns,
      droppedInterns,
      totalInterns,
      activeLeaders,
      activeDepartments,
      totalTasks,
      overdueTasks,
      tasksByStatusRaw,
      tasksByPriorityRaw,
      submissionsByStatusRaw,
      applicationsByStatusRaw,
      departments,
      leaders,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.intern.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.intern.count({ where: { status: "COMPLETED", deletedAt: null } }),
      prisma.intern.count({ where: { status: "DROPPED", deletedAt: null } }),
      prisma.intern.count({ where: { deletedAt: null } }),
      prisma.leader.count(),
      prisma.department.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.taskAssignment.count({
        where: {
          status: { not: "DONE" },
          task: { deadline: { lt: now }, deletedAt: null },
        },
      }),
      prisma.taskAssignment.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["priority"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.taskSubmission.groupBy({
        by: ["reviewStatus"],
        _count: { _all: true },
      }),
      prisma.application.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.department.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              interns: { where: { status: "ACTIVE", deletedAt: null } },
              leaderAssignments: true,
            },
          },
        },
      }),
      prisma.leader.findMany({
        take: 10,
        select: {
          id: true,
          userId: true,
          user: { select: { fullName: true } },
          departments: {
            select: {
              department: { select: { name: true } },
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          targetType: true,
          details: true,
          createdAt: true,
        },
      }),
    ]);

    // System Retention
    const retentionRate = totalInterns > 0 ? Math.round((activeInterns / totalInterns) * 100) : 0;

    // Task map
    let completedTasks = 0;
    let activeTasks = 0;
    let totalAssignments = 0;
    for (const item of tasksByStatusRaw) {
      totalAssignments += item._count._all;
      if (item.status === "DONE") {
        completedTasks += item._count._all;
      } else if (item.status === "IN_PROGRESS" || item.status === "TODO" || item.status === "REVIEW") {
        activeTasks += item._count._all;
      }
    }
    const systemCompletionRate = totalAssignments > 0 ? Math.round((completedTasks / totalAssignments) * 100) : 0;

    // Priority map
    const byPriority = { low: 0, medium: 0, high: 0 };
    for (const item of tasksByPriorityRaw) {
      if (item.priority === "LOW") byPriority.low = item._count._all;
      if (item.priority === "MEDIUM") byPriority.medium = item._count._all;
      if (item.priority === "HIGH") byPriority.high = item._count._all;
    }

    // Submissions map
    let pendingSubmissions = 0;
    let approvedSubmissions = 0;
    let rejectedSubmissions = 0;
    let totalSubmissions = 0;
    for (const item of submissionsByStatusRaw) {
      totalSubmissions += item._count._all;
      if (item.reviewStatus === "PENDING") pendingSubmissions = item._count._all;
      if (item.reviewStatus === "APPROVED") approvedSubmissions = item._count._all;
      if (item.reviewStatus === "REJECTED") rejectedSubmissions = item._count._all;
    }

    // Applications map
    let pendingApplications = 0;
    let approvedApplications = 0;
    let rejectedApplications = 0;
    let totalApplications = 0;
    for (const item of applicationsByStatusRaw) {
      totalApplications += item._count._all;
      if (item.status === "PENDING") pendingApplications = item._count._all;
      if (item.status === "APPROVED") approvedApplications = item._count._all;
      if (item.status === "REJECTED") rejectedApplications = item._count._all;
    }

    // Department Distribution
    const departmentDistribution: DepartmentDistributionDto[] = departments.map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      internCount: d._count.interns,
      leaderCount: d._count.leaderAssignments,
    }));

    // Leader teams performance
    const leaderTeams: LeaderTeamProgressDto[] = await Promise.all(
      leaders.map(async (leader) => {
        const internCount = await prisma.intern.count({
          where: { leaderId: leader.userId, status: "ACTIVE", deletedAt: null },
        });

        const assignments = await prisma.taskAssignment.groupBy({
          by: ["status"],
          where: {
            intern: { leaderId: leader.userId, deletedAt: null },
          },
          _count: { _all: true },
        });

        let activeCount = 0;
        let doneCount = 0;
        for (const a of assignments) {
          if (a.status === "DONE") doneCount += a._count._all;
          else if (a.status === "IN_PROGRESS" || a.status === "TODO" || a.status === "REVIEW") activeCount += a._count._all;
        }

        const overdueCount = await prisma.taskAssignment.count({
          where: {
            intern: { leaderId: leader.userId, deletedAt: null },
            status: { not: "DONE" },
            task: { deadline: { lt: now }, deletedAt: null },
          },
        });

        const riskLevel: "HEALTHY" | "WARNING" | "DANGER" =
          overdueCount >= 3 ? "DANGER" : overdueCount >= 1 ? "WARNING" : "HEALTHY";

        const deptName = leader.departments.map((dep) => dep.department.name).join(", ") || "Chưa gán";

        return {
          leaderId: leader.id,
          leaderName: leader.user?.fullName || "Leader",
          departmentName: deptName,
          internCount,
          activeTasksCount: activeCount,
          completedTasksCount: doneCount,
          overdueTasksCount: overdueCount,
          riskLevel,
        };
      })
    );

    // Recent Activities
    const recentActivities: RecentActivityDto[] = recentAuditLogs.map((log) => ({
      id: log.id,
      type: log.targetType,
      title: log.action,
      description:
        (log.details && typeof log.details === "object" && (log.details as any).summary) ||
        (log.details && typeof log.details === "object" && (log.details as any).message) ||
        `${log.action} trên ${log.targetType}`,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      system: {
        activeInterns,
        totalInterns,
        completedInterns,
        droppedInterns,
        retentionRate,
        activeLeaders,
        activeDepartments,
      },
      tasks: {
        activeTasks,
        completedTasks,
        overdueTasks,
        totalTasks,
        systemCompletionRate,
        byPriority,
      },
      submissions: {
        pendingSubmissions,
        approvedSubmissions,
        rejectedSubmissions,
        totalSubmissions,
      },
      applications: {
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        totalApplications,
      },
      departmentDistribution,
      leaderTeams,
      actionAlerts: {
        pendingApplicationsCount: pendingApplications,
        overdueTasksCount: overdueTasks,
        droppedInternsCount: droppedInterns,
      },
      recentActivities,
    };
  }

  /**
   * Thống kê dành cho Leader trong phạm vi quản lý
   */
  async getLeaderStats(leaderUserId: string): Promise<LeaderStatsResponseDto> {
    const now = new Date();
    const { startOfDay, endOfDay } = this.getVietnamDayRange(now);
    const { startOfWeek, endOfWeek } = this.getVietnamWeekRange(now);

    // Lấy danh sách TTS thuộc quyền quản lý
    const managedInterns = await prisma.intern.findMany({
      where: { leaderId: leaderUserId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        status: true,
        user: { select: { email: true, avatarUrl: true } },
      },
    });

    const totalInterns = managedInterns.length;
    const activeInterns = managedInterns.filter((i) => i.status === "ACTIVE").length;
    const internIds = managedInterns.map((i) => i.id);

    if (internIds.length === 0) {
      return {
        interns: { totalInterns: 0, activeInterns: 0 },
        workload: { activeWorkloadDays: 0, activeTasksCount: 0, totalAssignmentsCount: 0 },
        submissions: { pendingSubmissionsCount: 0, approvedSubmissionsCount: 0, rejectedSubmissionsCount: 0 },
        dailyReportRate: { todaySubmitted: 0, totalActiveInterns: 0, todayRate: 0, weeklySubmitted: 0, expectedWeeklyReports: 0, weeklyRate: 0 },
        tasksByStatus: { pendingApproval: 0, todo: 0, inProgress: 0, review: 0, done: 0, blocked: 0, overdueTasksCount: 0 },
        evaluations: { totalEvaluations: 0, avgScore: 0 },
        internProgress: [],
      };
    }

    const [
      assignmentsGroup,
      overdueTasksCount,
      activeTasksWorkload,
      submissionsGroup,
      todayReportsCount,
      weeklyReportsCount,
      evaluationsAggregate,
      individualInternData,
    ] = await Promise.all([
      prisma.taskAssignment.groupBy({
        by: ["status"],
        where: { internId: { in: internIds } },
        _count: { _all: true },
      }),
      prisma.taskAssignment.count({
        where: {
          internId: { in: internIds },
          status: { not: "DONE" },
          task: { deadline: { lt: now }, deletedAt: null },
        },
      }),
      prisma.taskAssignment.findMany({
        where: {
          internId: { in: internIds },
          status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
        },
        select: { task: { select: { estDays: true } } },
      }),
      prisma.taskSubmission.groupBy({
        by: ["reviewStatus"],
        where: { assignment: { internId: { in: internIds } } },
        _count: { _all: true },
      }),
      prisma.dailyReport.count({
        where: {
          internId: { in: internIds },
          date: { gte: startOfDay, lte: endOfDay },
          deletedAt: null,
        },
      }),
      prisma.dailyReport.count({
        where: {
          internId: { in: internIds },
          date: { gte: startOfWeek, lte: endOfWeek },
          deletedAt: null,
        },
      }),
      prisma.weeklyEvaluation.aggregate({
        where: { leaderId: leaderUserId, deletedAt: null },
        _count: { _all: true },
        _avg: { score: true },
      }),
      Promise.all(
        managedInterns.map(async (intern) => {
          const [total, done, overdue, avgScoreData] = await Promise.all([
            prisma.taskAssignment.count({ where: { internId: intern.id } }),
            prisma.taskAssignment.count({ where: { internId: intern.id, status: "DONE" } }),
            prisma.taskAssignment.count({
              where: {
                internId: intern.id,
                status: { not: "DONE" },
                task: { deadline: { lt: now }, deletedAt: null },
              },
            }),
            prisma.weeklyEvaluation.aggregate({
              where: { internId: intern.id, deletedAt: null },
              _avg: { score: true },
            }),
          ]);

          const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
          const avgScore = avgScoreData._avg.score ? Number(avgScoreData._avg.score.toFixed(1)) : 0;
          const healthStatus: "HEALTHY" | "WARNING" | "DANGER" =
            overdue >= 2 ? "DANGER" : overdue === 1 ? "WARNING" : "HEALTHY";

          return {
            internId: intern.id,
            fullName: intern.fullName,
            email: intern.user.email || "",
            avatarUrl: intern.user.avatarUrl,
            completedTasks: done,
            totalTasks: total,
            completionRate,
            avgScore,
            overdueTasks: overdue,
            healthStatus,
          };
        })
      ),
    ]);

    // Workload calculation
    let activeWorkloadDays = 0;
    for (const a of activeTasksWorkload) {
      activeWorkloadDays += a.task.estDays || 1;
    }

    // Status map
    const tasksByStatus = {
      pendingApproval: 0,
      todo: 0,
      inProgress: 0,
      review: 0,
      done: 0,
      blocked: 0,
      overdueTasksCount,
    };
    let totalAssignmentsCount = 0;
    let activeTasksCount = 0;

    for (const g of assignmentsGroup) {
      totalAssignmentsCount += g._count._all;
      if (g.status === "PENDING_APPROVAL") tasksByStatus.pendingApproval = g._count._all;
      if (g.status === "TODO") {
        tasksByStatus.todo = g._count._all;
        activeTasksCount += g._count._all;
      }
      if (g.status === "IN_PROGRESS") {
        tasksByStatus.inProgress = g._count._all;
        activeTasksCount += g._count._all;
      }
      if (g.status === "REVIEW") {
        tasksByStatus.review = g._count._all;
        activeTasksCount += g._count._all;
      }
      if (g.status === "DONE") tasksByStatus.done = g._count._all;
      if (g.status === "BLOCKED") tasksByStatus.blocked = g._count._all;
    }

    // Submissions map
    let pendingSubmissionsCount = 0;
    let approvedSubmissionsCount = 0;
    let rejectedSubmissionsCount = 0;
    for (const s of submissionsGroup) {
      if (s.reviewStatus === "PENDING") pendingSubmissionsCount = s._count._all;
      if (s.reviewStatus === "APPROVED") approvedSubmissionsCount = s._count._all;
      if (s.reviewStatus === "REJECTED") rejectedSubmissionsCount = s._count._all;
    }

    // Daily report rates
    const todayRate = activeInterns > 0 ? Math.round((todayReportsCount / activeInterns) * 100) : 0;
    const expectedWeeklyReports = activeInterns * 5; // 5 ngày làm việc / tuần
    const weeklyRate = expectedWeeklyReports > 0 ? Math.round((weeklyReportsCount / expectedWeeklyReports) * 100) : 0;

    return {
      interns: { totalInterns, activeInterns },
      workload: {
        activeWorkloadDays: Math.round(activeWorkloadDays * 10) / 10,
        activeTasksCount,
        totalAssignmentsCount,
      },
      submissions: {
        pendingSubmissionsCount,
        approvedSubmissionsCount,
        rejectedSubmissionsCount,
      },
      dailyReportRate: {
        todaySubmitted: todayReportsCount,
        totalActiveInterns: activeInterns,
        todayRate,
        weeklySubmitted: weeklyReportsCount,
        expectedWeeklyReports,
        weeklyRate,
      },
      tasksByStatus,
      evaluations: {
        totalEvaluations: evaluationsAggregate._count._all,
        avgScore: evaluationsAggregate._avg.score ? Number(evaluationsAggregate._avg.score.toFixed(1)) : 0,
      },
      internProgress: individualInternData,
    };
  }

  /**
   * Thống kê cá nhân dành cho Thực tập sinh
   */
  async getInternStats(internId: string): Promise<InternStatsResponseDto> {
    const now = new Date();
    const { startOfDay, endOfDay } = this.getVietnamDayRange(now);
    const { startOfWeek, endOfWeek } = this.getVietnamWeekRange(now);

    const intern = await prisma.intern.findUnique({
      where: { id: internId },
      include: {
        department: { select: { name: true } },
      },
    });

    if (!intern) {
      throw new Error("Intern not found");
    }

    const [
      assignmentsGroup,
      overdueTasks,
      todayReport,
      weeklyReportsCount,
      evaluations,
      recentReports,
      rejectedSubmissions,
      recentAssignments,
    ] = await Promise.all([
      prisma.taskAssignment.groupBy({
        by: ["status"],
        where: { internId },
        _count: { _all: true },
      }),
      prisma.taskAssignment.count({
        where: {
          internId,
          status: { not: "DONE" },
          task: { deadline: { lt: now }, deletedAt: null },
        },
      }),
      prisma.dailyReport.findFirst({
        where: {
          internId,
          date: { gte: startOfDay, lte: endOfDay },
          deletedAt: null,
        },
      }),
      prisma.dailyReport.count({
        where: {
          internId,
          date: { gte: startOfWeek, lte: endOfWeek },
          deletedAt: null,
        },
      }),
      prisma.weeklyEvaluation.findMany({
        where: { internId, deletedAt: null },
        orderBy: { week: "desc" },
        select: { score: true, week: true },
      }),
      prisma.dailyReport.findMany({
        where: { internId, deletedAt: null },
        orderBy: { date: "desc" },
        take: 30,
        select: { date: true },
      }),
      prisma.taskSubmission.findMany({
        where: {
          assignment: { internId },
          reviewStatus: "REJECTED",
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
        include: {
          assignment: {
            include: { task: { select: { title: true } } },
          },
        },
      }),
      prisma.taskAssignment.findMany({
        where: { internId },
        orderBy: { assignedAt: "desc" },
        take: 5,
        include: {
          task: {
            select: {
              id: true,
              code: true,
              title: true,
              priority: true,
              deadline: true,
            },
          },
        },
      }),
    ]);

    // Tasks calculation
    let inProgressTasks = 0;
    let completedTasks = 0;
    let blockedTasks = 0;
    let totalTasks = 0;

    for (const g of assignmentsGroup) {
      totalTasks += g._count._all;
      if (g.status === "IN_PROGRESS") inProgressTasks += g._count._all;
      if (g.status === "DONE") completedTasks += g._count._all;
      if (g.status === "BLOCKED") blockedTasks += g._count._all;
    }
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Report streak calculation
    let reportStreak = 0;
    const reportDateSet = new Set(
      recentReports.map((r) =>
        new Date(r.date).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
      )
    );

    let checkDate = new Date();
    // Nếu hôm nay chưa nộp, bắt đầu kiểm tra từ hôm qua để không làm mất streak
    const todayStr = checkDate.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    if (!reportDateSet.has(todayStr)) {
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    }

    for (let i = 0; i < 30; i++) {
      const dStr = checkDate.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
      const dayOfWeek = new Date(checkDate.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getDay();
      
      // Bỏ qua Thứ 7 (6) và Chủ Nhật (0) nếu không làm việc
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        continue;
      }

      if (reportDateSet.has(dStr)) {
        reportStreak++;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    // Evaluations calculation
    const totalEvaluations = evaluations.length;
    const lastWeekScore = evaluations.length > 0 ? evaluations[0].score : null;
    const sumScores = evaluations.reduce((acc, e) => acc + e.score, 0);
    const avgScore = totalEvaluations > 0 ? Number((sumScores / totalEvaluations).toFixed(1)) : 0;

    // Needs rework
    const needsRework: ReworkSubmissionDto[] = rejectedSubmissions.map((s) => ({
      submissionId: s.id,
      taskId: s.assignment.taskId,
      taskTitle: s.assignment.task.title,
      attempt: s.attempt,
      reviewComment: s.reviewComment,
      submittedAt: s.submittedAt.toISOString(),
    }));

    // Recent tasks
    const recentTasks: RecentTaskItemDto[] = recentAssignments.map((a) => ({
      id: a.task.id,
      code: a.task.code,
      title: a.task.title,
      priority: a.task.priority,
      status: a.status,
      deadline: a.task.deadline ? a.task.deadline.toISOString() : null,
      isOverdue: a.status !== "DONE" && Boolean(a.task.deadline && new Date(a.task.deadline) < now),
    }));

    return {
      internName: intern.fullName,
      internCode: intern.internCode,
      departmentName: intern.department?.name || "Chưa gán",
      tasks: {
        totalTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        blockedTasks,
        completionRate,
      },
      reports: {
        dailyReportTodaySubmitted: Boolean(todayReport),
        reportStreak,
        weeklyReportsSubmitted: weeklyReportsCount,
        workingDaysCount: 5,
      },
      evaluations: {
        lastWeekScore,
        avgScore,
        totalEvaluations,
      },
      needsRework,
      recentTasks,
    };
  }

  /**
   * Helper tìm internId theo userId
   */
  async findInternIdByUserId(userId: string): Promise<string | null> {
    const intern = await prisma.intern.findUnique({
      where: { userId },
      select: { id: true },
    });
    return intern ? intern.id : null;
  }
}

export const statsRepository = new StatsRepository();
