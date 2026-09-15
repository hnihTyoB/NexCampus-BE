import fs from "fs";
import path from "path";
import { EvaluationGrade } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  AiSuggestRequestDto,
  AiSuggestResponseDto,
  EvaluationRatings,
  RatingLevel,
} from "./weekly-evaluation.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { ROLES } from "../../common/constants/role.constant";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  toCalendarDate,
} from "../../common/helpers/date.helper";
import { VIETNAM_OFFSET_MS } from "../../common/constants/date.constant";

export function ratingToScore(level: RatingLevel): number {
  switch (level) {
    case "TOT":
      return 10;
    case "KHA":
      return 8;
    case "TB":
      return 6;
    case "TBY":
      return 4;
    case "YEU":
      return 2;
    default:
      return 6;
  }
}

export function computeAverageScore(ratings: EvaluationRatings): number {
  const scores = [
    ratingToScore(ratings.ruleCompliance),
    ratingToScore(ratings.workAttitude),
    ratingToScore(ratings.learningCapacity),
    ratingToScore(ratings.pressureTolerance),
    ratingToScore(ratings.communication),
    ratingToScore(ratings.knowledge),
    ratingToScore(ratings.practicalSkill),
    ratingToScore(ratings.languageProficiency),
    ratingToScore(ratings.teamwork),
    ratingToScore(ratings.creativity),
    ratingToScore(ratings.contentRequirement),
    ratingToScore(ratings.progressRequirement),
  ];

  const sum = scores.reduce((acc, curr) => acc + curr, 0);
  return Number((sum / 12).toFixed(2));
}

export function computeGrade(score: number): EvaluationGrade {
  if (score >= 8.0) return EvaluationGrade.TOT;
  if (score >= 6.5) return EvaluationGrade.KHA;
  if (score >= 5.0) return EvaluationGrade.TB;
  if (score >= 3.5) return EvaluationGrade.TBY;
  return EvaluationGrade.YEU;
}

export function getWeekDateRange(
  startDate: Date,
  week: number,
): { from: Date; to: Date } {
  // Midnight local Vietnam time of startDate
  const startMidnightVN = toCalendarDate(startDate);

  // Day offset for week N (week 1 = offset 0)
  const dayOffset = (week - 1) * 7;
  const fromLocalMs = startMidnightVN.getTime() + dayOffset * 24 * 3600 * 1000;
  const from = new Date(fromLocalMs - VIETNAM_OFFSET_MS);

  // End of the 7-day week
  const to = new Date(from.getTime() + 7 * 24 * 3600 * 1000 - 1);

  return { from, to };
}

export class WeeklyEvaluationAiService {
  async generateSuggestion(
    dto: AiSuggestRequestDto,
    actor: { id: string; role: string },
  ): Promise<AiSuggestResponseDto> {
    const intern = await prisma.intern.findUnique({
      where: { id: dto.internId },
      include: {
        department: true,
        position: true,
        user: true,
      },
    });

    if (!intern) {
      throw new AppError(
        "Hồ sơ thực tập sinh không tồn tại",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (actor.role === ROLES.LEADER) {
      const isDirect = intern.leaderId === actor.id;
      const leaderProfile = await prisma.leader.findUnique({
        where: { userId: actor.id },
        include: { departments: true },
      });
      const inDept = leaderProfile?.departments.some(
        (d: { departmentId: string }) => d.departmentId === intern.departmentId,
      );

      if (!isDirect && !inDept) {
        throw new AppError(
          "Bạn không có quyền đánh giá thực tập sinh này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // 1. Calculate week range in Vietnam time
    const weekRange = getWeekDateRange(new Date(intern.startDate), dto.week);

    // 2. Fetch daily reports and task submissions in that week
    const [dailyReports, taskSubmissions] = await Promise.all([
      prisma.dailyReport.findMany({
        where: {
          internId: dto.internId,
          deletedAt: null,
          date: {
            gte: new Date(weekRange.from.getTime() + VIETNAM_OFFSET_MS),
            lte: new Date(weekRange.to.getTime() + VIETNAM_OFFSET_MS),
          },
        },
        include: {
          attachments: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.taskSubmission.findMany({
        where: {
          submittedAt: {
            gte: weekRange.from,
            lte: weekRange.to,
          },
          assignment: {
            internId: dto.internId,
          },
        },
        include: {
          assignment: {
            include: {
              task: true,
            },
          },
          attachments: true,
        },
        orderBy: { submittedAt: "asc" },
      }),
    ]);

    // 3. Try calling Gemini if API key available, else use analytical heuristic
    const apiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS?.split(",")[0]?.trim());

    if (apiKey) {
      try {
        const geminiResult = await this.callGeminiApi(
          apiKey,
          intern.fullName,
          dto.week,
          weekRange,
          dailyReports,
          taskSubmissions,
        );
        if (geminiResult) {
          const score = computeAverageScore(geminiResult.ratings);
          const grade = computeGrade(score);
          return {
            ratings: geminiResult.ratings,
            score,
            grade,
            comment: geminiResult.comment,
            strengths: geminiResult.strengths,
            weaknesses: geminiResult.weaknesses,
            recommendations: geminiResult.recommendations,
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
      } catch (err: any) {
        console.warn(
          "[WeeklyEvaluationAiService] Gemini API call failed, falling back to smart heuristic evaluator:",
          err.message,
        );
      }
    }

    // 4. Smart Heuristic Evaluator based on 12 criteria & edge cases
    return this.evaluateHeuristic(
      intern.fullName,
      dto.week,
      weekRange,
      dailyReports,
      taskSubmissions,
    );
  }

  private async callGeminiApi(
    apiKey: string,
    internName: string,
    week: number,
    weekRange: { from: Date; to: Date },
    dailyReports: any[],
    taskSubmissions: any[],
  ): Promise<{
    ratings: EvaluationRatings;
    comment: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } | null> {
    const prompt = this.buildPrompt(
      internName,
      week,
      weekRange,
      dailyReports,
      taskSubmissions,
    );

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini HTTP ${response.status} ${response.statusText}`);
      }

      const json: any = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      return this.sanitizeOutput(parsed);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(
    internName: string,
    week: number,
    weekRange: { from: Date; to: Date },
    dailyReports: any[],
    taskSubmissions: any[],
  ): string {
    const fromStr = formatVietnamDate(weekRange.from);
    const toStr = formatVietnamDate(weekRange.to);

    const reportLines =
      dailyReports.length === 0
        ? "(Không có báo cáo hàng ngày nào)"
        : dailyReports
            .map(
              (r, i) =>
                `[${i + 1}] Ngày: ${formatVietnamDate(r.date)} | Giờ làm: ${r.hoursWorked}h | Nội dung: ${r.content} | Khó khăn: ${r.blockers || "Không"} | PR: ${r.prLink || "Không"} | Demo: ${r.videoDemo || "Không"}`,
            )
            .join("\n");

    const submissionLines =
      taskSubmissions.length === 0
        ? "(Không có bài nộp task nào)"
        : taskSubmissions
            .map(
              (s, i) =>
                `[${i + 1}] Task: ${s.assignment?.task?.title} | Lần nộp: #${s.attempt} | Trạng thái: ${s.reviewStatus} | Nhận xét Leader: ${s.reviewComment || "Chưa có"} | PR: ${s.prLink || "Không"}`,
            )
            .join("\n");

    let systemPrompt = "";
    try {
      const promptPath = path.resolve(
        process.cwd(),
        "ai/prompts/system/weekly-evaluation-assistant.md",
      );
      if (fs.existsSync(promptPath)) {
        systemPrompt = fs.readFileSync(promptPath, "utf-8") + "\n\n---\n";
      }
    } catch {
      // fallback to inline instructions
    }

    return `${systemPrompt}Bạn là Trợ lý AI hỗ trợ Leader đánh giá tuần cho Thực tập sinh ${internName} (Tuần ${week}: ${fromStr} đến ${toStr}) theo mẫu chuẩn 12 tiêu chí của NexCampus.

Dữ liệu hoạt động:
--- BÁO CÁO HÀNG NGÀY (${dailyReports.length} báo cáo) ---
${reportLines}

--- BÀI NỘP TASK (${taskSubmissions.length} bài nộp) ---
${submissionLines}

Yêu cầu output JSON duy nhất, không markdown:
{
  "ratings": {
    "ruleCompliance": "TOT | KHA | TB | TBY | YEU",
    "workAttitude": "TOT | KHA | TB | TBY | YEU",
    "learningCapacity": "TOT | KHA | TB | TBY | YEU",
    "pressureTolerance": "TOT | KHA | TB | TBY | YEU",
    "communication": "TOT | KHA | TB | TBY | YEU",
    "knowledge": "TOT | KHA | TB | TBY | YEU",
    "practicalSkill": "TOT | KHA | TB | TBY | YEU",
    "languageProficiency": "TOT | KHA | TB | TBY | YEU",
    "teamwork": "TOT | KHA | TB | TBY | YEU",
    "creativity": "TOT | KHA | TB | TBY | YEU",
    "contentRequirement": "TOT | KHA | TB | TBY | YEU",
    "progressRequirement": "TOT | KHA | TB | TBY | YEU"
  },
  "comment": "<Nhận xét khách quan chi tiết bằng tiếng Việt, từ 150-300 từ>",
  "strengths": ["<Điểm mạnh 1>", "<Điểm mạnh 2>"],
  "weaknesses": ["<Điểm cần cải thiện 1>"],
  "recommendations": ["<Lời khuyên định hướng tuần tới 1>", "<Lời khuyên 2>"]
}`;
  }

  private sanitizeOutput(obj: any) {
    const validRatings = ["TOT", "KHA", "TB", "TBY", "YEU"];
    const sanitizeRating = (r: any): RatingLevel =>
      typeof r === "string" && validRatings.includes(r)
        ? (r as RatingLevel)
        : "TB";

    const r = obj.ratings || {};
    return {
      ratings: {
        ruleCompliance: sanitizeRating(r.ruleCompliance),
        workAttitude: sanitizeRating(r.workAttitude),
        learningCapacity: sanitizeRating(r.learningCapacity),
        pressureTolerance: sanitizeRating(r.pressureTolerance),
        communication: sanitizeRating(r.communication),
        knowledge: sanitizeRating(r.knowledge),
        practicalSkill: sanitizeRating(r.practicalSkill),
        languageProficiency: sanitizeRating(r.languageProficiency),
        teamwork: sanitizeRating(r.teamwork),
        creativity: sanitizeRating(r.creativity),
        contentRequirement: sanitizeRating(r.contentRequirement),
        progressRequirement: sanitizeRating(r.progressRequirement),
      },
      comment: typeof obj.comment === "string" ? obj.comment : "Đánh giá tuần của thực tập sinh.",
      strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String) : [],
      weaknesses: Array.isArray(obj.weaknesses) ? obj.weaknesses.map(String) : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations.map(String) : [],
    };
  }

  private evaluateHeuristic(
    internName: string,
    week: number,
    weekRange: { from: Date; to: Date },
    dailyReports: any[],
    taskSubmissions: any[],
  ): AiSuggestResponseDto {
    const reportCount = dailyReports.length;
    const subCount = taskSubmissions.length;
    const approvedCount = taskSubmissions.filter(
      (s) => s.reviewStatus === "APPROVED",
    ).length;
    const rejectedCount = taskSubmissions.filter(
      (s) => s.reviewStatus === "REJECTED",
    ).length;

    // Edge Case: Zero Data Handling (rule in weekly-evaluation-12-criteria.json)
    if (reportCount === 0 && subCount === 0) {
      const ratings: EvaluationRatings = {
        ruleCompliance: "TB",
        workAttitude: "TB",
        learningCapacity: "TB",
        pressureTolerance: "TB",
        communication: "TB",
        knowledge: "TB",
        practicalSkill: "TB",
        languageProficiency: "TB",
        teamwork: "TB",
        creativity: "TB",
        contentRequirement: "TB",
        progressRequirement: "TB",
      };
      const score = 6.0;
      return {
        ratings,
        score,
        grade: EvaluationGrade.TB,
        comment: `AI gợi ý (Thiếu dữ liệu hoạt động tuần ${week}): Trong tuần vừa qua, Thực tập sinh ${internName} chưa nộp báo cáo hàng ngày hoặc bài nộp task nào trên hệ thống. Tất cả 12 tiêu chí được tạm xếp loại Trung bình (TB). Leader cần liên hệ trực tiếp với thực tập sinh để nắm bắt tình hình và nhắc nhở tuân thủ quy chế.`,
        strengths: ["Cần chủ động kết nối lại với Leader"],
        weaknesses: ["Chưa nộp báo cáo hàng ngày", "Chưa cập nhật tiến độ công việc"],
        recommendations: [
          "Nộp báo cáo hàng ngày đầy đủ từ thứ 2 đến thứ 6",
          "Chủ động liên hệ Mentor/Leader để nhận bàn giao công việc",
        ],
        dataUsed: {
          dailyReportsCount: 0,
          taskSubmissionsCount: 0,
          weekRange: {
            from: weekRange.from.toISOString(),
            to: weekRange.to.toISOString(),
          },
        },
      };
    }

    // Dynamic rating calculation based on actual empirical metrics
    let ruleCompliance: RatingLevel = "TB";
    if (reportCount >= 5) ruleCompliance = "TOT";
    else if (reportCount >= 4) ruleCompliance = "KHA";
    else if (reportCount >= 2) ruleCompliance = "TB";
    else ruleCompliance = "TBY";

    let workAttitude: RatingLevel = ruleCompliance;
    const hasBlockersReported = dailyReports.some((r) => r.blockers && r.blockers.trim().length > 0);
    const hasEvidence = dailyReports.some((r) => r.prLink || r.videoDemo || r.attachments?.length > 0);
    if (hasEvidence && reportCount >= 4) workAttitude = "TOT";

    let practicalSkill: RatingLevel = "TB";
    let contentRequirement: RatingLevel = "TB";
    let progressRequirement: RatingLevel = "TB";

    if (subCount > 0) {
      if (approvedCount === subCount) {
        practicalSkill = "TOT";
        contentRequirement = "TOT";
        progressRequirement = "TOT";
      } else if (approvedCount > 0 && rejectedCount === 0) {
        practicalSkill = "KHA";
        contentRequirement = "KHA";
        progressRequirement = "KHA";
      } else if (rejectedCount > 0) {
        practicalSkill = "TB";
        contentRequirement = "TB";
        progressRequirement = hasBlockersReported ? "TB" : "TBY";
      }
    } else {
      // If no task submission, evaluate primarily from daily report quality
      practicalSkill = hasEvidence ? "KHA" : "TB";
      contentRequirement = "TB";
      progressRequirement = reportCount >= 4 ? "KHA" : "TB";
    }

    const learningCapacity: RatingLevel = rejectedCount > 0 && approvedCount > 0 ? "TOT" : "KHA";
    const pressureTolerance: RatingLevel = hasBlockersReported ? "TOT" : "KHA";
    const communication: RatingLevel = hasEvidence || reportCount >= 4 ? "TOT" : "KHA";
    const knowledge: RatingLevel = practicalSkill;
    const languageProficiency: RatingLevel = "KHA";
    const teamwork: RatingLevel = "KHA";
    const creativity: RatingLevel = hasEvidence ? "TOT" : "KHA";

    const ratings: EvaluationRatings = {
      ruleCompliance,
      workAttitude,
      learningCapacity,
      pressureTolerance,
      communication,
      knowledge,
      practicalSkill,
      languageProficiency,
      teamwork,
      creativity,
      contentRequirement,
      progressRequirement,
    };

    const score = computeAverageScore(ratings);
    const grade = computeGrade(score);

    const taskTitles = taskSubmissions
      .map((s) => s.assignment?.task?.title)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    const strengths: string[] = [];
    if (reportCount >= 4) strengths.push(`Duy trì nộp báo cáo ngày đều đặn (${reportCount} ngày)`);
    if (hasEvidence) strengths.push("Chủ động gắn link PR/minh chứng công việc rõ ràng");
    if (approvedCount > 0) strengths.push(`Hoàn thành tốt các bài nộp công việc (${approvedCount} task đã được duyệt)`);
    if (strengths.length === 0) strengths.push("Có tinh thần học hỏi và tiếp thu");

    const weaknesses: string[] = [];
    if (reportCount < 5) weaknesses.push(`Còn thiếu ${Math.max(0, 5 - reportCount)} ngày báo cáo làm việc trong tuần`);
    if (rejectedCount > 0) weaknesses.push("Có task cần chỉnh sửa lại sau khi review");
    if (!hasEvidence) weaknesses.push("Nên bổ sung thêm PR link hoặc video demo minh chứng");

    const recommendations: string[] = [
      "Tiếp tục duy trì tính chủ động và trao đổi thường xuyên với Leader",
      "Rà soát kỹ acceptance criteria của từng task trước khi bấm nộp bài",
    ];

    const comment = `AI gợi ý đánh giá tuần ${week}: Thực tập sinh ${internName} đã hoàn thành ${reportCount} báo cáo hàng ngày và có ${subCount} lượt nộp bài${taskTitles ? ` (gồm: ${taskTitles})` : ""}. Nhìn chung, TTS thể hiện thái độ làm việc ${grade === "TOT" ? "rất tích cực và chuyên nghiệp" : "tốt, đáp ứng yêu cầu tiến độ"}. Chất lượng chuyên môn và khả năng phối hợp đạt mức ${grade}. Điểm trung bình 12 tiêu chí đề xuất là ${score.toFixed(1)} (${grade}).`;

    return {
      ratings,
      score,
      grade,
      comment,
      strengths,
      weaknesses,
      recommendations,
      dataUsed: {
        dailyReportsCount: reportCount,
        taskSubmissionsCount: subCount,
        weekRange: {
          from: weekRange.from.toISOString(),
          to: weekRange.to.toISOString(),
        },
      },
    };
  }
}
