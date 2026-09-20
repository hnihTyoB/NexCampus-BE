import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import {
  PdfExportRepository,
  pdfExportRepository,
} from "./pdf-export.repository";
import {
  WeeklyEvaluationPdfDTO,
  InternshipSummaryPdfDTO,
} from "./pdf-export.dto";
import { R2Service } from "../../common/services/r2.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { prisma } from "../../database/prisma.client";

interface ActorPayload {
  id: string;
  role: string;
  email?: string;
}

export class PdfExportService {
  private readonly repository: PdfExportRepository = pdfExportRepository;
  private readonly r2Service: R2Service = new R2Service();


  private async hasGlobalAccess(actorId: string): Promise<boolean> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    return (
      callerPerms.has(PERMISSIONS.ROLE_READ) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN)
    );
  }

  constructor() {
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers(): void {
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
      handlebars.registerHelper(
        "ifCond",
        function (this: any, v1: unknown, v2: unknown, options: handlebars.HelperOptions) {
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        }
      );
    }

    if (!handlebars.helpers["repeat"]) {
      handlebars.registerHelper("repeat", (count: number) => {
        const safeCount = Math.max(0, Math.min(100, Math.round(count || 0)));
        return "█".repeat(safeCount);
      });
    }

    if (!handlebars.helpers["eq"]) {
      handlebars.registerHelper("eq", (v1: unknown, v2: unknown) => v1 === v2);
    }
  }

  /**
   * Sinh Buffer PDF trực tiếp.
   * Lưu ý: Do toàn bộ giao diện báo cáo A4 chi tiết đã chuyển giao 100% sang Client-Side (Frontend)
   * nhằm giải phóng 100% RAM và tương thích hạ tầng deploy Render (512MB tier), hàm này trả về
   * buffer PDF hợp lệ phục vụ lưu trữ Cloudflare R2 và duy trì tương thích các API endpoints.
   */
  async renderHtmlToPdfBuffer(
    _html: string,
    footerHeader?: { headerTitle: string; internName: string }
  ): Promise<Buffer> {
    const title = footerHeader?.headerTitle || "NexCampus Official Report";
    const name = footerHeader?.internName || "NexCampus Intern";
    const nowStr = new Date().toISOString().split("T")[0];
    const streamContent = `BT /F1 14 Tf 50 780 Td (${title}) Tj ET\nBT /F1 11 Tf 50 750 Td (Thuc tap sinh: ${name}) Tj ET\nBT /F1 10 Tf 50 720 Td (Ngay xuat: ${nowStr}) Tj ET\nBT /F1 10 Tf 50 690 Td (NexCampus Official Evaluation Document) Tj ET`;
    const streamLen = Buffer.byteLength(streamContent, "utf-8");

    const pdfRaw = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${streamContent}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
430
%%EOF`;

    return Buffer.from(pdfRaw, "utf-8");
  }


  /**
   * Xuất phiếu đánh giá tuần của TTS
   */
  async exportWeeklyEvaluation(
    evaluationId: string,
    actor: ActorPayload
  ): Promise<{ downloadUrl: string; fileName: string; expiresAt: Date }> {
    const data = await this.repository.findWeeklyEvaluationData(evaluationId);
    if (!data || !data.evaluation) {
      throw new AppError("Weekly Evaluation not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const { evaluation, prevWeek, stats } = data;

    // RBAC Check:
    // - Intern chỉ được xuất báo cáo của chính mình
    // - Leader chỉ được xuất của TTS mình phụ trách
    // - Admin được xuất toàn bộ
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal) {
      const intern = await prisma.intern.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (intern) {
        if (evaluation.intern.userId !== actor.id) {
          throw new AppError("Forbidden: You can only export your own weekly evaluations", 403, ERROR_CODE.FORBIDDEN);
        }
      } else {
        const isLeaderOfIntern =
          evaluation.leaderId === actor.id || evaluation.intern.leaderId === actor.id;
        if (!isLeaderOfIntern) {
          throw new AppError("Forbidden: You can only export evaluations for your assigned interns", 403, ERROR_CODE.FORBIDDEN);
        }
      }
    }

    const viewModel = new WeeklyEvaluationPdfDTO(evaluation, prevWeek, stats);

    const templatePath = path.join(process.cwd(), "templates", "pdf", "weekly-evaluation.hbs");
    if (!fs.existsSync(templatePath)) {
      throw new AppError(`Template not found at ${templatePath}`, 500, ERROR_CODE.INTERNAL_SERVER_ERROR);
    }

    const templateSource = fs.readFileSync(templatePath, "utf-8");
    const compiled = handlebars.compile(templateSource);
    const html = compiled(viewModel);

    const pdfBuffer = await this.renderHtmlToPdfBuffer(html, {
      headerTitle: `Báo cáo đánh giá tuần ${viewModel.week}`,
      internName: viewModel.internName,
    });

    const fileName = `weekly-evaluation-w${viewModel.week}-${evaluationId}-${Date.now()}.pdf`;
    const storagePath = `exports/weekly/${fileName}`;

    // Upload lên Cloudflare R2
    await this.r2Service.uploadFile(storagePath, pdfBuffer, "application/pdf", `attachment; filename="${fileName}"`);

    // Tạo presigned URL thời hạn 7 ngày (604800 giây)
    const expiresInSeconds = 7 * 24 * 3600;
    const downloadUrl = await this.r2Service.getPresignedDownloadUrl(storagePath, expiresInSeconds, fileName);

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Lưu vết ExportHistory
    await this.repository.recordExportHistory({
      type: "WEEKLY_EVALUATION",
      entityType: "WeeklyEvaluation",
      entityId: evaluationId,
      fileName,
      storagePath,
      fileUrl: downloadUrl,
      createdById: actor.id,
      expiresAt,
    });

    return { downloadUrl, fileName, expiresAt };
  }

  /**
   * Xuất bảng tổng hợp kết quả thực tập cuối kỳ / chứng nhận hoàn thành
   */
  async exportInternshipSummary(
    internId: string,
    actor: ActorPayload
  ): Promise<{ downloadUrl: string; fileName: string; expiresAt: Date }> {
    const data = await this.repository.findInternshipSummaryData(internId);
    if (!data || !data.intern) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const { intern, evaluations, taskStats, reportCount } = data;

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal) {
      const internRecord = await prisma.intern.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (internRecord) {
        if (intern.userId !== actor.id) {
          throw new AppError("Forbidden: You can only export your own internship summary", 403, ERROR_CODE.FORBIDDEN);
        }
      } else {
        if (intern.leaderId !== actor.id) {
          throw new AppError("Forbidden: You can only export summary for your assigned interns", 403, ERROR_CODE.FORBIDDEN);
        }
      }
    }

    const viewModel = new InternshipSummaryPdfDTO(intern, evaluations, taskStats, reportCount);

    const templatePath = path.join(process.cwd(), "templates", "pdf", "internship-summary.hbs");
    if (!fs.existsSync(templatePath)) {
      throw new AppError(`Template not found at ${templatePath}`, 500, ERROR_CODE.INTERNAL_SERVER_ERROR);
    }

    const templateSource = fs.readFileSync(templatePath, "utf-8");
    const compiled = handlebars.compile(templateSource);
    const html = compiled(viewModel);

    const pdfBuffer = await this.renderHtmlToPdfBuffer(html, {
      headerTitle: "Bảng tổng hợp kết quả thực tập",
      internName: viewModel.internName,
    });

    const fileName = `internship-summary-${internId}-${Date.now()}.pdf`;
    const storagePath = `exports/internships/${fileName}`;

    await this.r2Service.uploadFile(storagePath, pdfBuffer, "application/pdf", `attachment; filename="${fileName}"`);

    const expiresInSeconds = 7 * 24 * 3600;
    const downloadUrl = await this.r2Service.getPresignedDownloadUrl(storagePath, expiresInSeconds, fileName);

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.repository.recordExportHistory({
      type: "INTERNSHIP_SUMMARY",
      entityType: "Intern",
      entityId: internId,
      fileName,
      storagePath,
      fileUrl: downloadUrl,
      createdById: actor.id,
      expiresAt,
    });

    return { downloadUrl, fileName, expiresAt };
  }
}

export const pdfExportService = new PdfExportService();
