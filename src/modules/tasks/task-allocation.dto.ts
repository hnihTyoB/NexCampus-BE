// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * Không cần request body — taskId lấy từ URL param, leaderId từ JWT.
 */
export interface AiRecommendationRequestDto {
  taskId: string;   // từ req.params.taskId
  leaderId: string; // từ req.user.id
}

// ─── Internal Scoring ─────────────────────────────────────────────────────────

/**
 * Dữ liệu intern đã được enrich từ DB, dùng cho scoring algorithm.
 */
export interface InternCandidateRaw {
  id: string;
  fullName: string;
  position: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  /** Tổng estDays của tất cả task đang active (TODO / IN_PROGRESS / REVIEW) */
  activeTaskDays: number;
  activeTaskCount: number;
  /** Điểm coding từ WeeklyEvaluation gần nhất. null nếu chưa có. */
  latestCodingScore: number | null;
  /** Điểm learning từ WeeklyEvaluation gần nhất. null nếu chưa có. */
  latestLearningScore: number | null;
  /** Danh sách module của các task đã DONE */
  completedModules: string[];
  /** Danh sách phase của các task đã DONE */
  completedPhases: string[];
}

/**
 * Candidate đã được tính đầy đủ điểm — dùng để truyền vào Gemini.
 */
export interface ScoredCandidate extends InternCandidateRaw {
  workloadScore: number;      // 0-100
  skillScore: number;         // 0-100
  performanceScore: number;   // 0-100
  learningScore: number;      // 0-100
  compatibilityScore: number; // 0-100, weighted final
  suggestedRole: "OWNER" | "SUPPORT";
}

// ─── Gemini JSON Output ───────────────────────────────────────────────────────

/**
 * Schema JSON mà Gemini phải trả về.
 * Dùng nội bộ để parse và validate response từ AI.
 */
export interface GeminiAllocationJson {
  recommendedOwnerId: string;
  recommendedSupportId: string | null;
  reasons: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  workloadAnalysis: string;
  learningOpportunity: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface CandidateSummaryDto {
  id: string;
  name: string;
  position: string | null;
  compatibilityScore: number;
  workloadScore: number;
  performanceScore: number;
  skillScore: number;
  learningScore: number;
  activeTaskDays: number;
  codingScore: number | null;
}

export interface AiRecommendationResponseDto {
  owner: {
    id: string;
    name: string;
    position: string | null;
    compatibilityScore: number;
    workloadDays: number;
    codingScore: number | null;
  };
  support: {
    id: string;
    name: string;
    position: string | null;
    compatibilityScore: number;
    workloadDays: number;
    codingScore: number | null;
  } | null;
  reasons: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  workloadAnalysis: string;
  learningOpportunity: string;
  /** Tất cả ứng viên đã được chấm điểm — cho UI hiển thị bảng */
  allCandidates: CandidateSummaryDto[];
  meta: {
    totalEvaluated: number;
    /** true nếu Gemini gọi thất bại, dùng fallback */
    aiFailed: boolean;
    generatedAt: string;
  };
}

// ─── Group Allocation DTOs ───────────────────────────────────────────────────

export interface GroupTaskAiRecommendationItemDto {
  taskId: string;
  taskTitle: string;
  taskCode: string | null;
  priority: string;
  estDays: number | null;
  deadline: string;
  suggestedOwner: {
    id: string;
    name: string;
    position: string | null;
    compatibilityScore: number;
    workloadDays: number;
  } | null;
  suggestedSupport: {
    id: string;
    name: string;
    position: string | null;
    compatibilityScore: number;
    workloadDays: number;
  } | null;
  reason: string;
}

export interface GroupAiRecommendationResponseDto {
  taskGroupId: string;
  taskGroupName: string;
  department: { id: string; name: string } | null;
  tasks: GroupTaskAiRecommendationItemDto[];
  summary: {
    totalUnassignedTasks: number;
    totalAllocated: number;
    unallocatableTasks: number;
    internsEvaluatedCount: number;
  };
}

export interface ConfirmGroupAllocationPayloadDto {
  assignments: {
    taskId: string;
    internId: string;
    supportId?: string | null;
  }[];
}

