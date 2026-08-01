import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import { prisma } from "../../database/prisma.client";
import { PuppeteerManager } from "./puppeteer.manager";
import { ASSIGNMENT_STATUS, REVIEW_STATUS } from "../constants/status.constant";
import { WeeklyEvaluationPdfDTO, TaskPerformanceItem } from "../../modules/pdf-export/weekly-evaluation-pdf.dto";
import { StorageService } from "./storage.service";
import { storageConfig } from "../../config/storage.config";

export class PdfService {
  private puppeteerManager = PuppeteerManager.getInstance();
  private storageService = new StorageService();

  constructor() {
    this.registerHelpers();
  }

  private registerHelpers() {
    if (!handlebars.helpers["formatScore"]) {
      handlebars.registerHelper("formatScore", (score: number | null | undefined) => {
        return score !== null && score !== undefined ? Number(score).toFixed(1) : "-";
      });
    }
    if (!handlebars.helpers["scoreColor"]) {
      handlebars.registerHelper("scoreColor", (score: number) => {
        if (score >= 9) return "#15803d";
        if (score >= 8) return "#2563eb";
        if (score >= 7) return "#d97706";
        return "#dc2626";
      });
    }
    if (!handlebars.helpers["ifCond"]) {
      handlebars.registerHelper("ifCond", (v1: unknown, v2: unknown, options: handlebars.HelperOptions) => {
        return v1 === v2 ? options.fn(options.data?.root) : options.inverse(options.data?.root);
      });
    }
    if (!handlebars.helpers["repeat"]) {
      handlebars.registerHelper("repeat", (count: number) => "█".repeat(Math.round(count)));
    }
  }

  private async collectWeeklyData(evaluationId: string) {
    // 1. Lấy thông tin đánh giá chính
    const evaluation = await prisma.weeklyEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        intern: { include: { user: true } },
        leader: true,
      },
    });
    if (!evaluation) throw new Error("Weekly Evaluation not found");

    // 2. Lấy đánh giá tuần trước (nếu có)
    const prevWeek = evaluation.week > 1
      ? await prisma.weeklyEvaluation.findUnique({
          where: {
            internId_week: {
              internId: evaluation.internId,
              week: evaluation.week - 1,
            },
          },
        })
      : null;

    // 3. Tính ngày bắt đầu/kết thúc của tuần đánh giá để lọc task
    const internStart = new Date(evaluation.intern.startDate);
    const weekOffsetMs = (evaluation.week - 1) * 7 * 24 * 60 * 60 * 1000;
    const weekStart = new Date(internStart.getTime() + weekOffsetMs);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 4. Lấy TaskAssignments của intern trong tuần (deadline trong khoảng tuần đó)
    const assignments = await prisma.taskAssignment.findMany({
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
    });

    // 5. Lấy DailyReport trong tuần
    const dailyReports = await prisma.dailyReport.findMany({
      where: {
        internId: evaluation.internId,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      select: { id: true },
    });

    // 6. Build task performance items
    const taskItems: TaskPerformanceItem[] = assignments.map((a) => {
      const isDone = a.status === ASSIGNMENT_STATUS.DONE;
      const totalSubs = a.submissions.length;
      const rejected = a.submissions.filter(s => s.reviewStatus === REVIEW_STATUS.REJECTED).length;
      return {
        title: a.task.title,
        code: a.task.code,
        status: a.status,
        isDone,
        submissionCount: totalSubs,
      };
    });

    // 7. Thống kê submission
    const allSubmissions = assignments.flatMap(a => a.submissions);
    const submissionTotal = allSubmissions.length;
    const rejectedTotal = allSubmissions.filter(s => s.reviewStatus === REVIEW_STATUS.REJECTED).length;
    const taskCompleted = assignments.filter(a => a.status === ASSIGNMENT_STATUS.DONE).length;

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

  public async generateWeeklyEvaluationBuffer(evaluationId: string): Promise<Buffer> {
    const { evaluation, prevWeek, stats } = await this.collectWeeklyData(evaluationId);

    const viewModel = new WeeklyEvaluationPdfDTO(evaluation, prevWeek, stats);

    const templatePath = path.join(process.cwd(), "templates", "pdf", "weekly-evaluation.hbs");
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, "utf8");
    const compiledTemplate = handlebars.compile(templateSource);
    const htmlContent = compiledTemplate(viewModel);

    const page = await this.puppeteerManager.createPage();
    try {
      await page.setContent(htmlContent, { waitUntil: "load" });
      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;padding:0 12mm;display:flex;justify-content:space-between;font-family:sans-serif;">
          <span>NexCampus – Internship Management System</span>
          <span>Báo cáo tuần số <strong>${viewModel.week}</strong> · ${viewModel.internName}</span>
        </div>`,
        footerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;padding:0 12mm;display:flex;justify-content:space-between;font-family:sans-serif;border-top:1px solid #e2e8f0;">
          <span>Generated by NexCampus v1.0 · ${viewModel.generatedAt}</span>
          <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      });
      return Buffer.from(buffer);
    } finally {
      await page.close();
    }
  }

  public async generateWeeklyEvaluationReport(
    evaluationId: string,
    userId: string,
  ): Promise<string> {
    const pdfBuffer = await this.generateWeeklyEvaluationBuffer(evaluationId);

    const fileName = `weekly-report-${evaluationId}-${Date.now()}.pdf`;
    const storagePath = `reports/weekly/${fileName}`;
    const namespace = storageConfig.namespaces.reports;

    const fileUrl = await this.storageService.uploadFile(
      namespace, storagePath, pdfBuffer, "application/pdf",
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
      await prisma.exportHistory.create({
        data: {
          type: "WEEKLY_EVALUATION",
          entityType: "WeeklyEvaluation",
          entityId: evaluationId,
          fileName,
          storagePath,
          fileUrl,
          createdById: userId,
          expiresAt,
        },
      });
    } catch (error) {
      await this.storageService.deleteFile(namespace, storagePath).catch((cleanupError) => {
        console.error(`[PdfService] Failed to roll back R2 object ${storagePath}:`, cleanupError);
      });
      throw error;
    }

    return fileUrl;
  }
}
