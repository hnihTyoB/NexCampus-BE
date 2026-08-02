import { aiService } from "../../common/services/ai.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { ScoredCandidate, GeminiAllocationJson } from "./task-allocation.dto";

interface TaskInfo {
  title: string;
  module: string;
  priority: string;
  estDays: number;
  description: string;
  deadline: Date;
  maxWorkloadDays: number;
}

export class TaskAllocationAiService {
  private buildPrompt(task: TaskInfo, candidates: ScoredCandidate[]): string {
    const ownerCandidate = candidates.find((c) => c.suggestedRole === "OWNER");
    const supportCandidate = candidates.find((c) => c.suggestedRole === "SUPPORT");

    const candidateList = candidates
      .map(
        (c, i) => `
[${i + 1}] ${c.fullName} — Vai trò đề xuất: ${c.suggestedRole}
  - Vị trí: ${c.position?.name ?? "Chưa xác định"}
  - Workload hiện tại: ${c.activeTaskDays} ngày (còn ${Math.max(0, task.maxWorkloadDays - c.activeTaskDays)} ngày trống)
  - Coding score (tuần gần nhất): ${c.latestCodingScore ?? "Chưa có"}/10
  - Learning score: ${c.latestLearningScore ?? "Chưa có"}/10
  - Module đã hoàn thành: ${c.completedModules.length > 0 ? c.completedModules.join(", ") : "Chưa có"}
  - Điểm Compatibility (do Backend tính): ${c.compatibilityScore}%
    • WorkloadScore: ${c.workloadScore}%
    • SkillScore: ${c.skillScore}%
    • PerformanceScore: ${c.performanceScore}%
    • LearningScore: ${c.learningScore}%`,
      )
      .join("\n");

    const ownerName = ownerCandidate?.fullName ?? "Chưa xác định";
    const supportName = supportCandidate?.fullName ?? "Không có";

    return `Bạn là AI Assistant hỗ trợ Leader phân bổ task cho Intern trong hệ thống NexCampus.

Bạn KHÔNG tự quyết định giao task — Leader là người chốt cuối cùng.
Backend đã tính toán điểm số. Nhiệm vụ của bạn:
1. Giải thích tại sao Owner được đề xuất (dựa vào dữ liệu đã có).
2. Đánh giá nguy cơ quá tải (riskLevel).
3. Giải thích cơ hội học tập.
4. Trả về JSON đúng schema — KHÔNG giải thích thêm ngoài JSON.

Ưu tiên:
- Không làm quá tải intern (workload từ 80% giới hạn của Task Group → HIGH risk).
- Cân bằng giữa hiệu suất và cơ hội phát triển.
- Intern giỏi có thể làm Support/Mentor để intern khác có cơ hội học.

========== THÔNG TIN TASK ==========
Tên: ${task.title}
Module: ${task.module}
Mức ưu tiên: ${task.priority}
Thời gian ước tính: ${task.estDays} ngày
Deadline: ${task.deadline.toLocaleDateString("vi-VN")}
Mô tả: ${task.description || "Không có mô tả"}

========== ỨNG VIÊN (đã được Backend tính điểm) ==========
${candidateList}

========== KẾT QUẢ BACKEND ĐỀ XUẤT ==========
Owner: ${ownerName} (${ownerCandidate?.compatibilityScore ?? 0}%)
Support: ${supportName} (${supportCandidate?.compatibilityScore ?? 0}%)

Hãy xác nhận và viết lời giải thích bằng tiếng Việt tự nhiên.
Trả về JSON đúng schema sau, KHÔNG thêm bất kỳ text nào ngoài JSON:

{
  "recommendedOwnerId": "<id của Owner>",
  "recommendedSupportId": "<id của Support hoặc null>",
  "reasons": ["<lý do 1>", "<lý do 2>", "<lý do 3>"],
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "workloadAnalysis": "<phân tích workload bằng tiếng Việt, 1-2 câu>",
  "learningOpportunity": "<giải thích cơ hội học tập, 1-2 câu>"
}`;
  }

  /**
   * Validate và normalize output từ Gemini.
   * Dùng fallback values nếu Gemini trả về dữ liệu không hợp lệ.
   */
  private validateOutput(
    raw: unknown,
    fallbackOwnerId: string,
    fallbackSupportId: string | null,
  ): GeminiAllocationJson {
    if (!raw || typeof raw !== "object") {
      throw new AppError(
        "AI trả về kết quả không đúng định dạng.",
        502,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    const obj = raw as Record<string, unknown>;

    const toStringArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map(String).filter(Boolean);
      return [];
    };

    const toRiskLevel = (val: unknown): "LOW" | "MEDIUM" | "HIGH" => {
      if (val === "LOW" || val === "MEDIUM" || val === "HIGH") return val;
      return "MEDIUM"; // safe default
    };

    return {
      recommendedOwnerId:
        typeof obj.recommendedOwnerId === "string" && obj.recommendedOwnerId
          ? obj.recommendedOwnerId
          : fallbackOwnerId,
      recommendedSupportId:
        typeof obj.recommendedSupportId === "string" && obj.recommendedSupportId
          ? obj.recommendedSupportId
          : fallbackSupportId,
      reasons: toStringArray(obj.reasons).length > 0
        ? toStringArray(obj.reasons)
        : ["Được đề xuất dựa trên phân tích workload và năng lực."],
      riskLevel: toRiskLevel(obj.riskLevel),
      workloadAnalysis:
        typeof obj.workloadAnalysis === "string" && obj.workloadAnalysis
          ? obj.workloadAnalysis
          : "Workload trong giới hạn cho phép.",
      learningOpportunity:
        typeof obj.learningOpportunity === "string" && obj.learningOpportunity
          ? obj.learningOpportunity
          : "Task phù hợp với năng lực hiện tại của intern.",
    };
  }

  /**
   * Entry point: được gọi từ TaskAllocationService.
   * Nhận candidates đã được Backend tính điểm → Gemini chỉ viết giải thích.
   */
  async generateRecommendation(
    task: TaskInfo,
    candidates: ScoredCandidate[],
  ): Promise<{
    reasons: string[];
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    workloadAnalysis: string;
    learningOpportunity: string;
  }> {
    const ownerCandidate   = candidates.find((c) => c.suggestedRole === "OWNER");
    const supportCandidate = candidates.find((c) => c.suggestedRole === "SUPPORT");

    const fallbackOwnerId   = ownerCandidate?.id ?? "";
    const fallbackSupportId = supportCandidate?.id ?? null;

    const prompt = this.buildPrompt(task, candidates);
    const rawResult = await aiService.generateJSON<unknown>(prompt);
    const validated = this.validateOutput(rawResult, fallbackOwnerId, fallbackSupportId);

    return {
      reasons:             validated.reasons,
      riskLevel:           validated.riskLevel,
      workloadAnalysis:    validated.workloadAnalysis,
      learningOpportunity: validated.learningOpportunity,
    };
  }
}
