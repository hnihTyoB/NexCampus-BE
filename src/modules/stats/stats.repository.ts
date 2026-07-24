import { prisma } from "../../database/prisma.client";
import {
  APPLICATION_STATUS,
  INTERN_STATUS,
  TASK_PRIORITY,
  ASSIGNMENT_STATUS,
  REVIEW_STATUS,
} from "../../common/constants/status.constant";
import {
  AssignmentDetailDto,
  LeaderTeamProgressDto,
  InternTeamProgressDto,
  InternPersonalStatsDto,
  ActivityLogDto,
} from "./stats.dto";

export class StatsRepository {
  private formatAssignments(assignments: any[]): AssignmentDetailDto[] {
    const now = new Date();
    return assignments.map((a) => {
      const deadline = a.task?.deadline ? new Date(a.task.deadline) : null;
      const isOverdue = Boolean(deadline && deadline < now && a.status !== ASSIGNMENT_STATUS.DONE);

      return {
        id: a.id,
        status: a.status,
        taskTitle: a.task?.title ?? "Untitled Task",
        taskPriority: a.task?.priority ?? "MEDIUM",
        taskDeadline: deadline ? deadline.toISOString() : null,
        isOverdue,
        internName: a.intern?.user?.fullName ?? a.intern?.fullName ?? "N/A",
        internEmail: a.intern?.user?.email ?? "N/A",
        leaderName: a.assigner?.fullName ?? "N/A",
      };
    });
  }

  async getAdminStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      // System
      totalLeaders,
      totalDepartments,
      totalUsers,

      // Interns
      totalInterns,
      activeInterns,
      completedInterns,
      droppedInterns,

      // Applications
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,

      // Tasks
      totalTasks,
      overdueTasksCount,
      tasksByPriority,

      // Assignments
      totalAssignments,
      assignmentsByStatus,

      // Submissions
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,

      // Daily Reports (last 30 days)
      reportsLast30Days,

      // Weekly Evaluations
      totalEvaluations,
      avgScore,

      // Notifications
      totalNotifications,
      unreadNotifications,

      // Detailed Assignments List
      rawAssignments,

      // Raw Leaders for Breakdown
      rawLeaders,

      // Single Query for Intern Counts by Leader (Eliminates N+1)
      groupedInternCounts,

      // Single Query for Assignments by Assigner (Eliminates N+1)
      allAssignerTasks,

      // Recent Activities
      recentSubmissionsRaw,
      recentReportsRaw,
      recentAppsRaw,
    ] = await Promise.all([
      // ─── System ──────────────────────────────────────────────────────────────
      prisma.leader.count(),
      prisma.department.count(),
      prisma.user.count({ where: { deletedAt: null } }),

      // ─── Interns ─────────────────────────────────────────────────────────────
      prisma.intern.count({ where: { deletedAt: null } }),
      prisma.intern.count({
        where: { deletedAt: null, status: INTERN_STATUS.ACTIVE },
      }),
      prisma.intern.count({
        where: { deletedAt: null, status: INTERN_STATUS.COMPLETED },
      }),
      prisma.intern.count({
        where: { deletedAt: null, status: INTERN_STATUS.DROPPED },
      }),

      // ─── Applications ─────────────────────────────────────────────────────────
      prisma.application.count({ where: { deletedAt: null } }),
      prisma.application.count({
        where: { deletedAt: null, status: APPLICATION_STATUS.PENDING },
      }),
      prisma.application.count({
        where: { deletedAt: null, status: APPLICATION_STATUS.APPROVED },
      }),
      prisma.application.count({
        where: { deletedAt: null, status: APPLICATION_STATUS.REJECTED },
      }),

      // ─── Tasks ────────────────────────────────────────────────────────────────
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null, deadline: { lt: now } } }),
      prisma.task.groupBy({
        by: ["priority"],
        where: { deletedAt: null },
        _count: true,
      }),

      // ─── Assignments ─────────────────────────────────────────────────────────
      prisma.taskAssignment.count(),
      prisma.taskAssignment.groupBy({ by: ["status"], _count: true }),

      // ─── Submissions ─────────────────────────────────────────────────────────
      prisma.taskSubmission.count(),
      prisma.taskSubmission.count({
        where: { reviewStatus: REVIEW_STATUS.PENDING },
      }),
      prisma.taskSubmission.count({
        where: { reviewStatus: REVIEW_STATUS.APPROVED },
      }),
      prisma.taskSubmission.count({
        where: { reviewStatus: REVIEW_STATUS.REJECTED },
      }),

      // ─── Daily Reports ───────────────────────────────────────────────────────
      prisma.dailyReport.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // ─── Weekly Evaluations ──────────────────────────────────────────────────
      prisma.weeklyEvaluation.count(),
      prisma.weeklyEvaluation.aggregate({ _avg: { totalScore: true } }),

      // ─── Notifications ───────────────────────────────────────────────────────
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),

      // ─── Detailed Assignments List ───────────────────────────────────────────
      prisma.taskAssignment.findMany({
        take: 100,
        orderBy: { updatedAt: "desc" },
        include: {
          task: { select: { title: true, priority: true, deadline: true } },
          intern: { select: { fullName: true, user: { select: { fullName: true, email: true } } } },
          assigner: { select: { fullName: true, email: true } },
        },
      }),

      // ─── Raw Leaders ─────────────────────────────────────────────────────────
      prisma.leader.findMany({
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          department: { select: { name: true } },
        },
      }),

      // ─── Single Grouped Intern Count (Eliminates N+1 Query) ──────────────────
      prisma.intern.groupBy({
        by: ["leaderId"],
        where: { deletedAt: null, leaderId: { not: null } },
        _count: { _all: true },
      }),

      // ─── Single Query for all Assignments (Eliminates N+1 Query) ────────────
      prisma.taskAssignment.findMany({
        select: {
          assignedBy: true,
          status: true,
          task: { select: { deadline: true } },
        },
      }),

      // ─── Recent Activities ───────────────────────────────────────────────────
      prisma.taskSubmission.findMany({
        take: 3,
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          submittedAt: true,
          assignment: {
            select: {
              task: { select: { title: true } },
              intern: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.dailyReport.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          intern: { select: { fullName: true } },
        },
      }),
      prisma.application.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        select: { id: true, fullName: true, createdAt: true, status: true },
      }),
    ]);

    // Reshape groupBy results
    const taskPriorityMap: Record<string, number> = {};
    tasksByPriority.forEach((r) => {
      taskPriorityMap[r.priority] = r._count;
    });

    const assignmentStatusMap: Record<string, number> = {};
    assignmentsByStatus.forEach((r) => {
      assignmentStatusMap[r.status] = r._count;
    });

    const formattedAssignments = this.formatAssignments(rawAssignments);
    const overdueAssignments = formattedAssignments.filter((a) => a.isOverdue);

    // Build fast lookup maps in memory
    const internCountMap = new Map<string, number>();
    groupedInternCounts.forEach((g) => {
      if (g.leaderId) {
        internCountMap.set(g.leaderId, g._count._all);
      }
    });

    const leaderAssignmentsMap = new Map<string, typeof allAssignerTasks>();
    allAssignerTasks.forEach((a) => {
      const existing = leaderAssignmentsMap.get(a.assignedBy) || [];
      existing.push(a);
      leaderAssignmentsMap.set(a.assignedBy, existing);
    });

    // Compute leader team progress synchronously without DB calls (0 extra queries)
    const leaderTeams: LeaderTeamProgressDto[] = rawLeaders.map((l) => {
      const assignments = leaderAssignmentsMap.get(l.userId) || [];
      const internCount = internCountMap.get(l.userId) || 0;

      const pendingApproval = assignments.filter(
        (a) => a.status === ASSIGNMENT_STATUS.PENDING_APPROVAL
      ).length;
      const todo = assignments.filter((a) => a.status === ASSIGNMENT_STATUS.TODO).length;
      const inProgress = assignments.filter(
        (a) => a.status === ASSIGNMENT_STATUS.IN_PROGRESS
      ).length;
      const review = assignments.filter((a) => a.status === ASSIGNMENT_STATUS.REVIEW).length;
      const done = assignments.filter((a) => a.status === ASSIGNMENT_STATUS.DONE).length;
      const blocked = assignments.filter((a) => a.status === ASSIGNMENT_STATUS.BLOCKED).length;

      const overdueCount = assignments.filter(
        (a) => a.task?.deadline && new Date(a.task.deadline) < now && a.status !== ASSIGNMENT_STATUS.DONE
      ).length;

      return {
        leaderId: l.id,
        leaderName: l.user?.fullName ?? "N/A",
        leaderEmail: l.user?.email ?? "",
        departmentName: l.department?.name ?? "Chưa xếp phòng",
        totalInterns: internCount,
        totalAssignments: assignments.length,
        assignments: {
          pendingApproval,
          todo,
          inProgress,
          review,
          done,
          blocked,
        },
        overdueCount,
      };
    });

    // Recent Activities list
    const recentActivities: ActivityLogDto[] = [
      ...recentSubmissionsRaw.map((s) => ({
        id: s.id,
        type: "SUBMISSION" as const,
        title: `Bài nộp mới: ${s.assignment?.task?.title ?? "Task"}`,
        description: `Thực tập sinh ${s.assignment?.intern?.fullName ?? "N/A"} đã nộp bài.`,
        createdAt: s.submittedAt.toISOString(),
      })),
      ...recentReportsRaw.map((r) => ({
        id: r.id,
        type: "DAILY_REPORT" as const,
        title: `Báo cáo Daily từ ${r.intern?.fullName ?? "N/A"}`,
        description: r.content ? r.content.slice(0, 60) + "..." : "Báo cáo công việc ngày.",
        createdAt: r.createdAt.toISOString(),
      })),
      ...recentAppsRaw.map((a) => ({
        id: a.id,
        type: "APPLICATION" as const,
        title: `Đơn ứng tuyển mới: ${a.fullName}`,
        description: `Trạng thái: ${a.status}`,
        createdAt: a.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    const doneCount = assignmentStatusMap[ASSIGNMENT_STATUS.DONE] ?? 0;
    const systemCompletionRate = totalAssignments > 0 ? Math.round((doneCount / totalAssignments) * 100) : 0;

    return {
      system: {
        leaders: totalLeaders,
        departments: totalDepartments,
        users: totalUsers,
      },
      interns: {
        total: totalInterns,
        active: activeInterns,
        completed: completedInterns,
        dropped: droppedInterns,
      },
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        approved: approvedApplications,
        rejected: rejectedApplications,
      },
      tasks: {
        total: totalTasks,
        overdue: overdueTasksCount,
        byPriority: {
          low: taskPriorityMap[TASK_PRIORITY.LOW] ?? 0,
          medium: taskPriorityMap[TASK_PRIORITY.MEDIUM] ?? 0,
          high: taskPriorityMap[TASK_PRIORITY.HIGH] ?? 0,
        },
      },
      assignments: {
        total: totalAssignments,
        byStatus: {
          pendingApproval:
            assignmentStatusMap[ASSIGNMENT_STATUS.PENDING_APPROVAL] ?? 0,
          todo: assignmentStatusMap[ASSIGNMENT_STATUS.TODO] ?? 0,
          inProgress: assignmentStatusMap[ASSIGNMENT_STATUS.IN_PROGRESS] ?? 0,
          review: assignmentStatusMap[ASSIGNMENT_STATUS.REVIEW] ?? 0,
          done: assignmentStatusMap[ASSIGNMENT_STATUS.DONE] ?? 0,
          blocked: assignmentStatusMap[ASSIGNMENT_STATUS.BLOCKED] ?? 0,
        },
      },
      submissions: {
        total: totalSubmissions,
        pending: pendingSubmissions,
        approved: approvedSubmissions,
        rejected: rejectedSubmissions,
      },
      dailyReports: {
        last30Days: reportsLast30Days,
        avgPerDay: parseFloat((reportsLast30Days / 30).toFixed(2)),
      },
      weeklyEvaluations: {
        total: totalEvaluations,
        avgScore: parseFloat((avgScore._avg.totalScore ?? 0).toFixed(2)),
      },
      notifications: {
        total: totalNotifications,
        unread: unreadNotifications,
      },
      recentAssignments: formattedAssignments,
      overdueAssignments,
      leaderTeams,
      systemCompletionRate,
      recentActivities,
    };
  }

  async getLeaderStats(leaderId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalInterns,
      activeInterns,
      completedInterns,
      droppedInterns,
      assignmentsByStatus,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      reportsLast30Days,
      totalEvaluations,
      avgScore,
      rawAssignments,
      myInterns,

      // Batch query all intern assignments to eliminate N+1 query
      allMyInternAssignments,

      // Batch query all intern evaluation averages to eliminate N+1 query
      allMyInternEvaluationAvg,
    ] = await Promise.all([
      prisma.intern.count({ where: { deletedAt: null, leaderId } }),
      prisma.intern.count({
        where: { deletedAt: null, leaderId, status: INTERN_STATUS.ACTIVE },
      }),
      prisma.intern.count({
        where: { deletedAt: null, leaderId, status: INTERN_STATUS.COMPLETED },
      }),
      prisma.intern.count({
        where: { deletedAt: null, leaderId, status: INTERN_STATUS.DROPPED },
      }),
      prisma.taskAssignment.groupBy({
        by: ["status"],
        where: { assignedBy: leaderId },
        _count: true,
      }),
      prisma.taskSubmission.count({
        where: {
          reviewStatus: REVIEW_STATUS.PENDING,
          assignment: { assignedBy: leaderId },
        },
      }),
      prisma.taskSubmission.count({
        where: {
          reviewStatus: REVIEW_STATUS.APPROVED,
          assignment: { assignedBy: leaderId },
        },
      }),
      prisma.taskSubmission.count({
        where: {
          reviewStatus: REVIEW_STATUS.REJECTED,
          assignment: { assignedBy: leaderId },
        },
      }),
      prisma.dailyReport.count({
        where: { createdAt: { gte: thirtyDaysAgo }, intern: { leaderId } },
      }),
      prisma.weeklyEvaluation.count({ where: { leaderId } }),
      prisma.weeklyEvaluation.aggregate({
        _avg: { totalScore: true },
        where: { leaderId },
      }),
      prisma.taskAssignment.findMany({
        where: { assignedBy: leaderId },
        take: 100,
        orderBy: { updatedAt: "desc" },
        include: {
          task: { select: { title: true, priority: true, deadline: true } },
          intern: { select: { fullName: true, user: { select: { fullName: true, email: true } } } },
          assigner: { select: { fullName: true, email: true } },
        },
      }),
      prisma.intern.findMany({
        where: { leaderId, deletedAt: null },
        include: { user: { select: { fullName: true, email: true } } },
      }),

      // Batch query for all intern assignments (Eliminates N+1)
      prisma.taskAssignment.findMany({
        where: { intern: { leaderId, deletedAt: null } },
        select: {
          internId: true,
          status: true,
          task: { select: { deadline: true } },
        },
      }),

      // Batch query for all evaluation averages (Eliminates N+1)
      prisma.weeklyEvaluation.groupBy({
        by: ["internId"],
        where: { intern: { leaderId, deletedAt: null } },
        _avg: { totalScore: true },
      }),
    ]);

    const assignmentStatusMap: Record<string, number> = {};
    assignmentsByStatus.forEach((r) => {
      assignmentStatusMap[r.status] = r._count;
    });

    const formattedAssignments = this.formatAssignments(rawAssignments);
    const overdueAssignments = formattedAssignments.filter((a) => a.isOverdue);

    // Build fast lookup maps in memory
    const internAssignmentsMap = new Map<string, typeof allMyInternAssignments>();
    allMyInternAssignments.forEach((a) => {
      const existing = internAssignmentsMap.get(a.internId) || [];
      existing.push(a);
      internAssignmentsMap.set(a.internId, existing);
    });

    const evalAvgMap = new Map<string, number>();
    allMyInternEvaluationAvg.forEach((e) => {
      evalAvgMap.set(e.internId, e._avg.totalScore ?? 0);
    });

    // Compute progress for each intern synchronously (0 extra DB queries)
    const internProgress: InternTeamProgressDto[] = myInterns.map((intern) => {
      const internAssignments = internAssignmentsMap.get(intern.id) || [];
      const avgScoreRaw = evalAvgMap.get(intern.id) || 0;

      const completedTasks = internAssignments.filter(
        (a) => a.status === ASSIGNMENT_STATUS.DONE
      ).length;
      const totalTasks = internAssignments.length;
      const overdueCount = internAssignments.filter(
        (a) => a.task?.deadline && new Date(a.task.deadline) < now && a.status !== ASSIGNMENT_STATUS.DONE
      ).length;
      const avgScoreVal = parseFloat(avgScoreRaw.toFixed(1));

      let healthStatus: "HEALTHY" | "WARNING" | "DANGER" = "HEALTHY";
      if (overdueCount >= 2 || (avgScoreVal > 0 && avgScoreVal < 5)) {
        healthStatus = "DANGER";
      } else if (overdueCount === 1 || (avgScoreVal > 0 && avgScoreVal < 7)) {
        healthStatus = "WARNING";
      }

      return {
        internId: intern.id,
        internName: intern.fullName ?? intern.user?.fullName ?? "N/A",
        internEmail: intern.user?.email ?? "",
        completedTasks,
        totalTasks,
        avgScore: avgScoreVal,
        overdueCount,
        healthStatus,
      };
    });

    return {
      interns: {
        total: totalInterns,
        active: activeInterns,
        completed: completedInterns,
        dropped: droppedInterns,
      },
      assignments: {
        byStatus: {
          pendingApproval:
            assignmentStatusMap[ASSIGNMENT_STATUS.PENDING_APPROVAL] ?? 0,
          todo: assignmentStatusMap[ASSIGNMENT_STATUS.TODO] ?? 0,
          inProgress: assignmentStatusMap[ASSIGNMENT_STATUS.IN_PROGRESS] ?? 0,
          review: assignmentStatusMap[ASSIGNMENT_STATUS.REVIEW] ?? 0,
          done: assignmentStatusMap[ASSIGNMENT_STATUS.DONE] ?? 0,
          blocked: assignmentStatusMap[ASSIGNMENT_STATUS.BLOCKED] ?? 0,
        },
      },
      submissions: {
        pending: pendingSubmissions,
        approved: approvedSubmissions,
        rejected: rejectedSubmissions,
      },
      dailyReports: {
        last30Days: reportsLast30Days,
        avgPerDay: parseFloat((reportsLast30Days / 30).toFixed(2)),
      },
      weeklyEvaluations: {
        total: totalEvaluations,
        avgScore: parseFloat((avgScore._avg.totalScore ?? 0).toFixed(2)),
      },
      recentAssignments: formattedAssignments,
      overdueAssignments,
      internProgress,
    };
  }

  async getInternStats(userId: string): Promise<InternPersonalStatsDto> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter out deleted interns for soft delete compliance
    const intern = await prisma.intern.findFirst({
      where: { userId, deletedAt: null },
      include: { user: { select: { fullName: true } } },
    });

    if (!intern) {
      return {
        internName: "Thực Tập Sinh",
        tasksInProgress: 0,
        tasksCompleted: 0,
        totalTasks: 0,
        completionRate: 0,
        dailyReportTodaySubmitted: false,
        lastWeekScore: null,
        avgScore: 0,
        todaysTasks: [],
      };
    }

    const [assignments, dailyReportToday, evaluations] = await Promise.all([
      prisma.taskAssignment.findMany({
        where: { internId: intern.id },
        include: {
          task: { select: { title: true, priority: true, deadline: true } },
          intern: { select: { fullName: true, user: { select: { fullName: true, email: true } } } },
          assigner: { select: { fullName: true, email: true } },
        },
      }),
      prisma.dailyReport.findFirst({
        where: { internId: intern.id, createdAt: { gte: startOfToday } },
      }),
      prisma.weeklyEvaluation.findMany({
        where: { internId: intern.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const tasksInProgress = assignments.filter(
      (a) => a.status === ASSIGNMENT_STATUS.IN_PROGRESS
    ).length;
    const tasksCompleted = assignments.filter(
      (a) => a.status === ASSIGNMENT_STATUS.DONE
    ).length;
    const totalTasks = assignments.length;
    const completionRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;

    const scores = evaluations.map((e) => e.totalScore);
    const avgScore = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    const lastWeekScore = evaluations[0] ? evaluations[0].totalScore : null;

    const formattedTodays = this.formatAssignments(assignments);

    return {
      internName: intern.fullName ?? intern.user?.fullName ?? "Thực Tập Sinh",
      tasksInProgress,
      tasksCompleted,
      totalTasks,
      completionRate,
      dailyReportTodaySubmitted: Boolean(dailyReportToday),
      lastWeekScore,
      avgScore,
      todaysTasks: formattedTodays,
    };
  }
}
