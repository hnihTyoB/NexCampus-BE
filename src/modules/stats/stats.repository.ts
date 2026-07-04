import { prisma } from '../../database/prisma.client';
import {
  APPLICATION_STATUS,
  INTERN_STATUS,
  TASK_PRIORITY,
  ASSIGNMENT_STATUS,
  REVIEW_STATUS,
} from '../../common/constants/status.constant';

export class StatsRepository {
  async getAdminStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
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
    ] = await Promise.all([
      // ─── Interns ─────────────────────────────────────────────────────────────
      prisma.intern.count({ where: { deletedAt: null } }),
      prisma.intern.count({ where: { deletedAt: null, status: INTERN_STATUS.ACTIVE } }),
      prisma.intern.count({ where: { deletedAt: null, status: INTERN_STATUS.COMPLETED } }),
      prisma.intern.count({ where: { deletedAt: null, status: INTERN_STATUS.DROPPED } }),

      // ─── Applications ─────────────────────────────────────────────────────────
      prisma.application.count({ where: { deletedAt: null } }),
      prisma.application.count({ where: { deletedAt: null, status: APPLICATION_STATUS.PENDING } }),
      prisma.application.count({ where: { deletedAt: null, status: APPLICATION_STATUS.APPROVED } }),
      prisma.application.count({ where: { deletedAt: null, status: APPLICATION_STATUS.REJECTED } }),

      // ─── Tasks ────────────────────────────────────────────────────────────────
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null, deadline: { lt: now } } }),
      prisma.task.groupBy({ by: ['priority'], where: { deletedAt: null }, _count: true }),

      // ─── Assignments ─────────────────────────────────────────────────────────
      prisma.taskAssignment.count(),
      prisma.taskAssignment.groupBy({ by: ['status'], _count: true }),

      // ─── Submissions ─────────────────────────────────────────────────────────
      prisma.taskSubmission.count(),
      prisma.taskSubmission.count({ where: { reviewStatus: REVIEW_STATUS.PENDING } }),
      prisma.taskSubmission.count({ where: { reviewStatus: REVIEW_STATUS.APPROVED } }),
      prisma.taskSubmission.count({ where: { reviewStatus: REVIEW_STATUS.REJECTED } }),

      // ─── Daily Reports ───────────────────────────────────────────────────────
      prisma.dailyReport.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),

      // ─── Weekly Evaluations ──────────────────────────────────────────────────
      prisma.weeklyEvaluation.count(),
      prisma.weeklyEvaluation.aggregate({ _avg: { totalScore: true } }),

      // ─── Notifications ───────────────────────────────────────────────────────
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
    ]);

    // Reshape groupBy results
    const taskPriorityMap: Record<string, number> = {};
    tasksByPriority.forEach((r) => { taskPriorityMap[r.priority] = r._count; });

    const assignmentStatusMap: Record<string, number> = {};
    assignmentsByStatus.forEach((r) => { assignmentStatusMap[r.status] = r._count; });

    return {
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
          low:    taskPriorityMap[TASK_PRIORITY.LOW]    ?? 0,
          medium: taskPriorityMap[TASK_PRIORITY.MEDIUM] ?? 0,
          high:   taskPriorityMap[TASK_PRIORITY.HIGH]   ?? 0,
        },
      },
      assignments: {
        total: totalAssignments,
        byStatus: {
          todo:       assignmentStatusMap[ASSIGNMENT_STATUS.TODO]        ?? 0,
          inProgress: assignmentStatusMap[ASSIGNMENT_STATUS.IN_PROGRESS] ?? 0,
          review:     assignmentStatusMap[ASSIGNMENT_STATUS.REVIEW]      ?? 0,
          done:       assignmentStatusMap[ASSIGNMENT_STATUS.DONE]        ?? 0,
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
    ] = await Promise.all([
      prisma.intern.count({ where: { deletedAt: null, leaderId } }),
      prisma.intern.count({ where: { deletedAt: null, leaderId, status: INTERN_STATUS.ACTIVE } }),
      prisma.intern.count({ where: { deletedAt: null, leaderId, status: INTERN_STATUS.COMPLETED } }),
      prisma.intern.count({ where: { deletedAt: null, leaderId, status: INTERN_STATUS.DROPPED } }),
      prisma.taskAssignment.groupBy({ by: ['status'], where: { assignedBy: leaderId }, _count: true }),
      prisma.taskSubmission.count({ where: { reviewStatus: REVIEW_STATUS.PENDING,  assignment: { assignedBy: leaderId } } }),
      prisma.taskSubmission.count({ where: { reviewStatus: REVIEW_STATUS.APPROVED, assignment: { assignedBy: leaderId } } }),
      prisma.taskSubmission.count({ where: { reviewStatus: REVIEW_STATUS.REJECTED, assignment: { assignedBy: leaderId } } }),
      prisma.dailyReport.count({ where: { createdAt: { gte: thirtyDaysAgo }, intern: { leaderId } } }),
      prisma.weeklyEvaluation.count({ where: { leaderId } }),
      prisma.weeklyEvaluation.aggregate({ _avg: { totalScore: true }, where: { leaderId } }),
    ]);

    const assignmentStatusMap: Record<string, number> = {};
    assignmentsByStatus.forEach((r) => { assignmentStatusMap[r.status] = r._count; });

    return {
      interns: {
        total: totalInterns,
        active: activeInterns,
        completed: completedInterns,
        dropped: droppedInterns,
      },
      assignments: {
        byStatus: {
          todo:       assignmentStatusMap[ASSIGNMENT_STATUS.TODO]        ?? 0,
          inProgress: assignmentStatusMap[ASSIGNMENT_STATUS.IN_PROGRESS] ?? 0,
          review:     assignmentStatusMap[ASSIGNMENT_STATUS.REVIEW]      ?? 0,
          done:       assignmentStatusMap[ASSIGNMENT_STATUS.DONE]        ?? 0,
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
    };
  }
}
