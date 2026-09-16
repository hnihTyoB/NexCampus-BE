import { prisma } from "../../database/prisma.client";
import { TaskPerformanceItem } from "./pdf-export.dto";

export class PdfExportRepository {
  /**
   * Lấy toàn bộ dữ liệu đánh giá tuần phục vụ xuất PDF
   */
  async findWeeklyEvaluationData(evaluationId: string) {
    const evaluation = await prisma.weeklyEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        intern: {
          include: {
            user: true,
            department: true,
            position: true,
          },
        },
        leader: true,
      },
    });

    if (!evaluation) {
      return null;
    }

    const prevWeek =
      evaluation.week > 1
        ? await prisma.weeklyEvaluation.findFirst({
            where: {
              internId: evaluation.internId,
              week: evaluation.week - 1,
              deletedAt: null,
            },
          })
        : null;

    const internStart = new Date(evaluation.intern.startDate);
    const weekOffsetMs = (evaluation.week - 1) * 7 * 24 * 60 * 60 * 1000;
    const weekStart = new Date(internStart.getTime() + weekOffsetMs);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [assignments, dailyReports] = await Promise.all([
      prisma.taskAssignment.findMany({
        where: {
          internId: evaluation.internId,
          task: {
            deadline: { gte: weekStart, lt: weekEnd },
          },
        },
        include: {
          task: { select: { id: true, title: true, code: true } },
          submissions: {
            select: { reviewStatus: true, attempt: true },
            orderBy: { attempt: "desc" },
          },
        },
      }),
      prisma.dailyReport.findMany({
        where: {
          internId: evaluation.internId,
          date: { gte: weekStart, lt: weekEnd },
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);

    const taskItems: TaskPerformanceItem[] = assignments.map((a) => {
      const isDone = a.status === "DONE";
      const totalSubs = a.submissions.length;
      return {
        title: a.task.title,
        code: a.task.code,
        status: a.status,
        isDone,
        submissionCount: totalSubs,
      };
    });

    const allSubmissions = assignments.flatMap((a) => a.submissions);
    const submissionTotal = allSubmissions.length;
    const rejectedTotal = allSubmissions.filter((s) => s.reviewStatus === "REJECTED").length;
    const taskCompleted = assignments.filter((a) => a.status === "DONE").length;

    return {
      evaluation,
      prevWeek,
      stats: {
        taskTotal: assignments.length,
        taskCompleted,
        taskItems,
        dailyReportTotal: dailyReports.length,
        submissionTotal,
        rejectedTotal,
      },
    };
  }

  /**
   * Lấy toàn bộ dữ liệu tổng kết thực tập phục vụ xuất PDF
   */
  async findInternshipSummaryData(internId: string) {
    const intern = await prisma.intern.findUnique({
      where: { id: internId },
      include: {
        user: true,
        leader: true,
        department: true,
        position: true,
      },
    });

    if (!intern) {
      return null;
    }

    const [evaluations, totalTasks, completedTasks, reportCount] = await Promise.all([
      prisma.weeklyEvaluation.findMany({
        where: { internId, deletedAt: null },
        orderBy: { week: "asc" },
      }),
      prisma.taskAssignment.count({ where: { internId } }),
      prisma.taskAssignment.count({ where: { internId, status: "DONE" } }),
      prisma.dailyReport.count({ where: { internId, deletedAt: null } }),
    ]);

    return {
      intern,
      evaluations,
      taskStats: {
        total: totalTasks,
        completed: completedTasks,
      },
      reportCount,
    };
  }

  /**
   * Ghi nhận lịch sử xuất file vào bảng ExportHistory
   */
  async recordExportHistory(data: {
    type: string;
    entityType: string;
    entityId: string;
    fileName: string;
    storagePath: string;
    fileUrl: string;
    createdById: string;
    expiresAt: Date;
  }) {
    return prisma.exportHistory.create({
      data: {
        type: data.type,
        entityType: data.entityType,
        entityId: data.entityId,
        fileName: data.fileName,
        storagePath: data.storagePath,
        fileUrl: data.fileUrl,
        createdById: data.createdById,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Helper tìm intern theo userId
   */
  async findInternByUserId(userId: string) {
    return prisma.intern.findUnique({
      where: { userId },
      select: { id: true },
    });
  }
}

export const pdfExportRepository = new PdfExportRepository();
