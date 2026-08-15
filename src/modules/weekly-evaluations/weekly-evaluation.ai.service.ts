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
  EvaluationRatings,
  RatingLevel,
} from "./weekly-evaluation.dto";
import { computeLegacyScores, ratingToScore } from "./weekly-evaluation.service";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

const VALID_RATINGS: RatingLevel[] = ["TOT", "KHA", "TB", "TBY", "YEU"];

export class WeeklyEvaluationAiService {
  private readonly internRepository = new InternRepository();

  /**
   * Tính ngày bắt đầu và kết thúc của tuần thứ N (1-based)
   * tính từ ngày bắt đầu thực tập của intern.
   */
  private getWeekDateRange(
    startDate: Date,
    week: number,
  ): { from: Date; to: Date } {
    const tzOffset = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh is UTC+7

    // Convert startDate to Vietnam local time first
    const startLocal = new Date(new Date(startDate).getTime() + tzOffset);
    // Find midnight local Vietnam time for the start date
    const startMidnightLocal = new Date(Date.UTC(
      startLocal.getUTCFullYear(),
      startLocal.getUTCMonth(),
      startLocal.getUTCDate(),
      0, 0, 0, 0
    ));

    // Calculate start of the requested week in Vietnam local time
    const dayOffset = (week - 1) * 7;
    const fromLocal = new Date(startMidnightLocal.getTime() + dayOffset * 24 * 3600 * 1000);
    // Convert back to UTC representation by subtracting offset
    const from = new Date(fromLocal.getTime() - tzOffset);

    // End of the week is fromLocal + 7 days - 1 ms
    const to = new Date(from.getTime() + 7 * 24 * 3600 * 1000 - 1);

    return { from, to };
  }

  /**
   * Định dạng Date thành chuỗi dễ đọc (tiếng Việt) cho prompt.
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
   * Yêu cầu AI trả về xếp loại (TOT/KHA/TB/TBY/YEU) cho 12 tiêu chí.
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
        .map((r, idx) => {
          const dateStr = this.formatDateVi(r.createdAt);
          const lines = [
            `[${idx + 1}] Ngày: ${dateStr}`,
            `    Nội dung: ${r.content}`,
          ];
          if (r.prLink) lines.push(`    PR Link: ${r.prLink}`);
          if (r.videoDemo) lines.push(`    Video Demo: ${r.videoDemo}`);
          return lines.join("\n");
        })
        .join("\n---\n");
    }

    // Phần Task Submissions
    let taskSection: string;
    if (taskSubmissions.length === 0) {
      taskSection = "(Không có bài nộp task nào trong tuần này)";
    } else {
      taskSection = taskSubmissions
        .map((s, idx) => {
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
        })
        .join("\n---\n");
    }

    const noDataNote =
      dailyReports.length === 0 && taskSubmissions.length === 0
        ? "\nLưu ý: Không có dữ liệu nào trong tuần này. Hãy đặt mặc định là TB (trung bình) cho tất cả tiêu chí và ghi rõ trong comment là không đủ dữ liệu để đánh giá.\n"
        : "";

    return `Bạn là Leader của công ty phần mềm, đang đánh giá thực tập sinh cuối tuần theo mẫu đánh giá chuẩn.

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

Mức xếp loại (chỉ được dùng đúng 5 giá trị này):
- "TOT"  = Tốt        (10 điểm)
- "KHA"  = Khá        (8 điểm)
- "TB"   = Trung bình (6 điểm)
- "TBY"  = Trung bình yếu (4 điểm)
- "YEU"  = Yếu        (2 điểm)

Schema JSON bắt buộc:
{
  "ratings": {
    "ruleCompliance":   "<mức xếp loại>",
    "workAttitude":     "<mức xếp loại>",
    "learningCapacity": "<mức xếp loại>",
    "resilience":       "<mức xếp loại>",
    "communication":    "<mức xếp loại>",
    "knowledge":        "<mức xếp loại>",
    "practicalSkills":  "<mức xếp loại>",
    "foreignLanguage":  "<mức xếp loại>",
    "teamwork":         "<mức xếp loại>",
    "creativity":       "<mức xếp loại>",
    "contentQuality":   "<mức xếp loại>",
    "progressDelivery": "<mức xếp loại>"
  },
  "comment": "<nhận xét tổng quan khoảng 150 từ bằng tiếng Việt>",
  "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>", ...],
  "weaknesses": ["<điểm yếu 1>", "<điểm yếu 2>", ...],
  "suggestions": ["<gợi ý cải thiện 1>", "<gợi ý cải thiện 2>", ...]
}

Hướng dẫn đánh giá từng tiêu chí (Phần I – Kỷ luật và tư chất):
- ruleCompliance (Thực hiện nội quy): nộp báo cáo đúng giờ, tuân thủ quy định về giờ làm việc
- workAttitude (Thái độ làm việc): chủ động, tích cực, không bỏ ngày báo cáo, phản hồi kịp thời
- learningCapacity (Năng lực tiếp thu): ghi lại kiến thức mới, cải thiện theo phản hồi
- resilience (Khả năng vượt khó): xử lý khi task bị reject, tiếp tục cải thiện sau thất bại
- communication (Giao tiếp và ứng xử): nội dung báo cáo rõ ràng, chuyên nghiệp, có PR/video khi cần

Hướng dẫn đánh giá từng tiêu chí (Phần II – Khả năng chuyên môn):
- knowledge (Kiến thức): độ chính xác và chiều sâu trong báo cáo và bài nộp
- practicalSkills (Kỹ năng thực hành): chất lượng code, tỷ lệ APPROVED vs REJECTED
- foreignLanguage (Năng lực ngoại ngữ): sử dụng tiếng Anh trong tên biến/hàm, comment, PR title
- teamwork (Kỹ năng làm việc nhóm): phối hợp nhóm, tuân theo quy ước nhóm
- creativity (Tính sáng tạo): đề xuất giải pháp mới, cải tiến workflow

Hướng dẫn đánh giá từng tiêu chí (Phần III – Kết quả thực hiện đề tài):
- contentQuality (Nội dung): mức độ hoàn thành yêu cầu về chất lượng sản phẩm nộp
- progressDelivery (Tiến độ): hoàn thành task đúng deadline, số task đã xong / tổng số task

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

    const validateRatings = (ratingsRaw: unknown): EvaluationRatings => {
      if (!ratingsRaw || typeof ratingsRaw !== "object") {
        // Fallback: trả về TB cho tất cả nếu không có ratings
        return {
          ruleCompliance: "TB", workAttitude: "TB", learningCapacity: "TB",
          resilience: "TB", communication: "TB", knowledge: "TB",
          practicalSkills: "TB", foreignLanguage: "TB", teamwork: "TB",
          creativity: "TB", contentQuality: "TB", progressDelivery: "TB",
        };
      }

      const r = ratingsRaw as Record<string, unknown>;
      const sanitize = (val: unknown, field: string): RatingLevel => {
        if (typeof val === "string" && VALID_RATINGS.includes(val as RatingLevel)) {
          return val as RatingLevel;
        }
        console.warn(`[AI] Invalid rating for field "${field}": ${val}, defaulting to TB`);
        return "TB";
      };

      return {
        ruleCompliance:   sanitize(r.ruleCompliance,   "ruleCompliance"),
        workAttitude:     sanitize(r.workAttitude,     "workAttitude"),
        learningCapacity: sanitize(r.learningCapacity, "learningCapacity"),
        resilience:       sanitize(r.resilience,       "resilience"),
        communication:    sanitize(r.communication,    "communication"),
        knowledge:        sanitize(r.knowledge,        "knowledge"),
        practicalSkills:  sanitize(r.practicalSkills,  "practicalSkills"),
        foreignLanguage:  sanitize(r.foreignLanguage,  "foreignLanguage"),
        teamwork:         sanitize(r.teamwork,         "teamwork"),
        creativity:       sanitize(r.creativity,       "creativity"),
        contentQuality:   sanitize(r.contentQuality,   "contentQuality"),
        progressDelivery: sanitize(r.progressDelivery, "progressDelivery"),
      };
    };

    const toStringArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map(String);
      return [];
    };

    return {
      ratings: validateRatings(obj.ratings),
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

    // 6. Gọi AI Service
    let rawResult: unknown;
    try {
      rawResult = await aiService.generateJSON<unknown>(prompt);
    } catch (aiError) {
      console.warn(
        "[WeeklyEvaluationAiService] Gemini API call failed, using mock fallback data:",
        aiError,
      );
      const hasActivity = dailyReports.length > 0 || taskSubmissions.length > 0;
      rawResult = {
        ratings: {
          ruleCompliance:   hasActivity ? "KHA" : "TB",
          workAttitude:     hasActivity ? "KHA" : "TB",
          learningCapacity: hasActivity ? "KHA" : "TB",
          resilience:       hasActivity ? "KHA" : "TB",
          communication:    hasActivity ? "KHA" : "TB",
          knowledge:        hasActivity ? "KHA" : "TB",
          practicalSkills:  hasActivity ? "KHA" : "TB",
          foreignLanguage:  "TB",
          teamwork:         hasActivity ? "KHA" : "TB",
          creativity:       "TB",
          contentQuality:   hasActivity ? "KHA" : "TB",
          progressDelivery: hasActivity ? "KHA" : "TB",
        },
        comment: hasActivity
          ? "AI gợi ý (Chế độ Fallback): Thực tập sinh hoàn thành tốt các công việc được giao, tiến độ ổn định, giao tiếp tích cực với team. Kỹ năng lập trình đạt yêu cầu."
          : "AI gợi ý (Chế độ Fallback do thiếu dữ liệu): Thực tập sinh chưa có báo cáo hàng ngày hay bài nộp nào trong tuần này. Cần nhắc nhở cập nhật thông tin.",
        strengths: hasActivity ? ["Hoàn thành task đúng hạn", "Thái độ tích cực"] : [],
        weaknesses: hasActivity ? ["Cần cải thiện chất lượng code"] : ["Thiếu báo cáo/sản phẩm thực tế"],
        suggestions: hasActivity
          ? ["Tiếp tục phát huy tính chủ động", "Tìm hiểu thêm Clean Code"]
          : ["Liên hệ Mentor để cập nhật tiến độ"],
      };
    }

    // 7. Validate & normalize
    const validated = this.validateGeminiOutput(rawResult);

    // 8. Tính toán điểm số từ ratings để trả về cho client preview
    const computed = computeLegacyScores(validated.ratings);

    // 9. Trả về response
    return {
      ratings: validated.ratings,
      ...computed,
      comment: validated.comment,
      strengths: validated.strengths,
      weaknesses: validated.weaknesses,
      suggestions: validated.suggestions,
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
