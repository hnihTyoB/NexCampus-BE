import { prisma } from "../../database/prisma.client";
import { InternRepository } from "../interns/intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { aiService } from "../../common/services/ai.service";
import { ROLES } from "../../common/constants/role.constant";
import {
  AiSuggestionRequestDto,
  AiSuggestionResponseDto,
  GeminiEvaluationJson,
} from "./weekly-evaluation.dto";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class WeeklyEvaluationAiService {
  private readonly internRepository = new InternRepository();

  /**
   * Tính ngày bắt đầu và kết thúc của tuần thứ N (1-based)
   * tính từ ngày bắt đầu thực tập của intern.
   * Tuần 1: startDate → startDate + 6 ngày
   * Tuần 2: startDate + 7 → startDate + 13 ngày
   * ...
   */
  private getWeekDateRange(
    startDate: Date,
    week: number,
  ): { from: Date; to: Date } {
    const dayOffset = (week - 1) * 7;
    const from = new Date(startDate);
    from.setDate(from.getDate() + dayOffset);
    from.setHours(0, 0, 0, 0);

    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }

  /**
   * Định dạng Date thành chuỗi dễ đọc (tiếng Việt) cho prompt.
   * Ví dụ: "Thứ Hai, 01/07/2026"
   */
  private formatDateVi(date: Date): string {
    const days = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    const dayName = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dayName}, ${dd}/${mm}/${yyyy}`;
  }

  /**
   * Lấy dữ liệu DailyReport của intern trong khoảng tuần cụ thể.
   */
  private async getDailyReportsInRange(internId: string, from: Date, to: Date) {
    return prisma.dailyReport.findMany({
      where: {
        internId,
        createdAt: { gte: from, lte: to },
        intern: { deletedAt: null },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Lấy dữ liệu TaskSubmission của intern trong khoảng tuần cụ thể.
   */
  private async getTaskSubmissionsInRange(
    internId: string,
    from: Date,
    to: Date,
  ) {
    return prisma.taskSubmission.findMany({
      where: {
        submittedAt: { gte: from, lte: to },
        assignment: {
          internId,
          intern: { deletedAt: null },
          task: { deletedAt: null },
        },
      },
      select: {
        id: true,
        assignmentId: true,
        attempt: true,
        prLink: true,
        videoDemo: true,
        note: true,
        reviewStatus: true,
        reviewComment: true,
        reviewedBy: true,
        reviewedAt: true,
        submittedAt: true,
        updatedAt: true,
        assignment: {
          select: {
            id: true,
            taskId: true,
            internId: true,
            assignedBy: true,
            status: true,
            task: {
              select: {
                title: true,
                description: true,
                deadline: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    });
  }

  /**
   * Xây dựng prompt tiếng Việt gửi tới Gemini.
   */
  private buildPrompt(params: {
    internName: string;
    week: number;
    weekRange: { from: Date; to: Date };
    dailyReports: Array<{
      createdAt: Date;
      content: string;
      prLink: string | null;
      videoDemo: string | null;
    }>;
    taskSubmissions: Array<{
      attempt: number;
      reviewStatus: string;
      prLink: string | null;
      videoDemo: string | null;
      note: string | null;
      reviewComment: string | null;
      assignment: {
        task: {
          title: string;
          description: string | null;
          deadline: Date;
        };
      };
    }>;
  }): string {
    const { internName, week, weekRange, dailyReports, taskSubmissions } =
      params;

    const fromStr = this.formatDateVi(weekRange.from);
    const toStr = this.formatDateVi(weekRange.to);

    // Phần Daily Reports
    let dailyReportSection: string;
    if (dailyReports.length === 0) {
      dailyReportSection = "(Không có báo cáo hàng ngày nào trong tuần này)";
    } else {
      dailyReportSection = dailyReports
        .map(
          (
            r: {
              createdAt: Date;
              content: string;
              prLink: string | null;
              videoDemo: string | null;
            },
            idx: number,
          ) => {
            const dateStr = this.formatDateVi(r.createdAt);
            const lines = [
              `[${idx + 1}] Ngày: ${dateStr}`,
              `    Nội dung: ${r.content}`,
            ];
            if (r.prLink) lines.push(`    PR Link: ${r.prLink}`);
            if (r.videoDemo) lines.push(`    Video Demo: ${r.videoDemo}`);
            return lines.join("\n");
          },
        )
        .join("\n---\n");
    }

    // Phần Task Submissions
    let taskSection: string;
    if (taskSubmissions.length === 0) {
      taskSection = "(Không có bài nộp task nào trong tuần này)";
    } else {
      taskSection = taskSubmissions
        .map(
          (
            s: {
              attempt: number;
              reviewStatus: string;
              prLink: string | null;
              videoDemo: string | null;
              note: string | null;
              reviewComment: string | null;
              assignment: {
                task: {
                  title: string;
                  description: string | null;
                  deadline: Date;
                };
              };
            },
            idx: number,
          ) => {
            const task = s.assignment.task;
            const deadlineStr = task.deadline
              ? this.formatDateVi(new Date(task.deadline))
              : "Không có deadline";
            const lines = [
              `[${idx + 1}] Task: ${task.title}`,
              `    Deadline: ${deadlineStr}`,
              `    Lần nộp: #${s.attempt}`,
              `    Trạng thái: ${s.reviewStatus}`,
            ];
            if (s.prLink) lines.push(`    PR Link: ${s.prLink}`);
            if (s.videoDemo) lines.push(`    Video Demo: ${s.videoDemo}`);
            if (s.note) lines.push(`    Ghi chú của intern: ${s.note}`);
            if (s.reviewComment)
              lines.push(`    Nhận xét của Leader: ${s.reviewComment}`);
            return lines.join("\n");
          },
        )
        .join("\n---\n");
    }

    const noDataNote =
      dailyReports.length === 0 && taskSubmissions.length === 0
        ? "\nLưu ý: Không có dữ liệu nào trong tuần này. Hãy đặt điểm mặc định là 5 và ghi rõ trong comment là không đủ dữ liệu để đánh giá.\n"
        : "";

    return `Bạn là Leader của công ty phần mềm, đang đánh giá thực tập sinh cuối tuần.

Hãy phân tích dữ liệu bên dưới và đưa ra đánh giá khách quan, chi tiết.
${noDataNote}
========== THÔNG TIN INTERN ==========
Tên: ${internName}
Tuần thứ: ${week} (từ ${fromStr} đến ${toStr})

========== BÁO CÁO HÀNG NGÀY (${dailyReports.length} báo cáo) ==========
${dailyReportSection}

========== BÀI NỘP TASK (${taskSubmissions.length} bài nộp) ==========
${taskSection}

==========================================

Bạn PHẢI trả về JSON. Không được giải thích thêm. Không dùng markdown.

Schema JSON bắt buộc:
{
  "communication": <số từ 1 đến 10, bước 0.5>,
  "attitude": <số từ 1 đến 10, bước 0.5>,
  "learning": <số từ 1 đến 10, bước 0.5>,
  "coding": <số từ 1 đến 10, bước 0.5>,
  "comment": "<nhận xét tổng quan khoảng 150 từ bằng tiếng Việt>",
  "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>", ...],
  "weaknesses": ["<điểm yếu 1>", "<điểm yếu 2>", ...],
  "suggestions": ["<gợi ý cải thiện 1>", "<gợi ý cải thiện 2>", ...]
}

Tiêu chí chấm điểm:
- communication (giao tiếp): báo cáo đầy đủ, nội dung rõ ràng, đúng hạn, có cả PR/video khi cần
- attitude (thái độ): chủ động, tích cực, không bỏ ngày báo cáo, tự giải quyết vấn đề
- learning (tự học): ghi lại kiến thức mới, cải thiện theo phản hồi, học hỏi từ thất bại
- coding (viết code): chất lượng bài nộp, tỷ lệ APPROVED vs REJECTED, PR link hợp lệ, số lần phải nộp lại

strengths: 2-4 điểm mạnh cụ thể
weaknesses: 1-3 điểm cần cải thiện (nếu không có thì mảng rỗng [])
suggestions: 2-4 đề xuất hành động cụ thể giúp intern tiến bộ`;
  }

  /**
   * Validate và normalize output từ Gemini.
   */
  private validateGeminiOutput(raw: unknown): GeminiEvaluationJson {
    if (!raw || typeof raw !== "object") {
      throw new AppError(
        "AI trả về kết quả không đúng định dạng.",
        502,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    const obj = raw as Record<string, unknown>;

    const clampScore = (val: unknown, field: string): number => {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num)) {
        throw new AppError(
          `AI trả về điểm '${field}' không hợp lệ: ${val}`,
          502,
          ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
      // Làm tròn đến bước 0.5, clamp vào [1, 10]
      return Math.min(10, Math.max(1, Math.round(num * 2) / 2));
    };

    const toStringArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map(String);
      return [];
    };

    return {
      communication: clampScore(obj.communication, "communication"),
      attitude: clampScore(obj.attitude, "attitude"),
      learning: clampScore(obj.learning, "learning"),
      coding: clampScore(obj.coding, "coding"),
      comment:
        typeof obj.comment === "string"
          ? obj.comment
          : "AI không cung cấp nhận xét.",
      strengths: toStringArray(obj.strengths),
      weaknesses: toStringArray(obj.weaknesses),
      suggestions: toStringArray(obj.suggestions),
    };
  }

  /**
   * Entry point chính: Được gọi khi Leader nhấn "AI gợi ý".
   */
  async getSuggestion(
    data: AiSuggestionRequestDto,
    user: UserPayload,
  ): Promise<AiSuggestionResponseDto> {
    // 1. Kiểm tra intern tồn tại
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError(
        "Không tìm thấy thực tập sinh.",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // 2. Kiểm tra quyền: Leader chỉ xem intern của mình
    if (user.role === ROLES.LEADER && intern.leaderId !== user.id) {
      throw new AppError(
        "Bạn không có quyền đánh giá thực tập sinh này.",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // 3. Tính khoảng ngày của tuần
    const weekRange = this.getWeekDateRange(
      new Date(intern.startDate),
      data.week,
    );

    // 4. Lấy dữ liệu trong tuần
    const [dailyReports, taskSubmissions] = await Promise.all([
      this.getDailyReportsInRange(data.internId, weekRange.from, weekRange.to),
      this.getTaskSubmissionsInRange(
        data.internId,
        weekRange.from,
        weekRange.to,
      ),
    ]);

    // 5. Build prompt
    const internName = intern.user?.fullName || intern.fullName;
    const prompt = this.buildPrompt({
      internName,
      week: data.week,
      weekRange,
      dailyReports,
      taskSubmissions,
    });

    // 6. Gọi AI Service (Gemini/OpenAI/DeepSeek...) thông qua Interface chung
    const rawResult = await aiService.generateJSON<unknown>(prompt);

    // 7. Validate & normalize
    const validated = this.validateGeminiOutput(rawResult);

    // 8. Trả về response
    return {
      ...validated,
      dataUsed: {
        dailyReportsCount: dailyReports.length,
        taskSubmissionsCount: taskSubmissions.length,
        weekRange: {
          from: weekRange.from.toISOString(),
          to: weekRange.to.toISOString(),
        },
      },
    };
  }
}
