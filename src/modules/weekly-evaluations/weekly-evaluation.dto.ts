// ─── Rating Level ────────────────────────────────────────────────────────────
// 5 mức xếp loại: TOT=10, KHA=8, TB=6, TBY=4, YEU=2
export type RatingLevel = "TOT" | "KHA" | "TB" | "TBY" | "YEU";

/**
 * 12 tiêu chí đánh giá theo mẫu mới.
 * Phần I – Kỷ luật và tư chất (5 tiêu chí):
 *   ruleCompliance, workAttitude, learningCapacity, resilience, communication
 * Phần II – Khả năng chuyên môn (5 tiêu chí):
 *   knowledge, practicalSkills, foreignLanguage, teamwork, creativity
 * Phần III – Kết quả thực hiện đề tài (2 tiêu chí):
 *   contentQuality, progressDelivery
 */
export interface EvaluationRatings {
  // Phần I: Kỷ luật và tư chất
  ruleCompliance: RatingLevel;   // 1. Thực hiện nội quy của cơ quan
  workAttitude: RatingLevel;     // 2. Thái độ làm việc
  learningCapacity: RatingLevel; // 3. Năng lực tiếp thu
  resilience: RatingLevel;       // 4. Khả năng vượt khó, chịu áp lực
  communication: RatingLevel;    // 5. Giao tiếp và ứng xử

  // Phần II: Khả năng chuyên môn
  knowledge: RatingLevel;        // 1. Kiến thức
  practicalSkills: RatingLevel;  // 2. Kỹ năng thực hành
  foreignLanguage: RatingLevel;  // 3. Năng lực ngoại ngữ
  teamwork: RatingLevel;         // 4. Kỹ năng làm việc nhóm
  creativity: RatingLevel;       // 5. Tính sáng tạo

  // Phần III: Kết quả thực hiện đề tài
  contentQuality: RatingLevel;   // 1. Thực hiện yêu cầu về nội dung
  progressDelivery: RatingLevel; // 2. Thực hiện yêu cầu về tiến độ
}

// ─── Query ───────────────────────────────────────────────────────────────────

export interface WeeklyEvaluationQueryDto {
  internId?: string;
  leaderId?: string;
  week?: number;
  sortBy?: "week" | "totalScore" | "createdAt";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// ─── Create / Update ─────────────────────────────────────────────────────────

export interface CreateWeeklyEvaluationDto {
  internId: string;
  week: number;
  // Có thể truyền ratings mới hoặc 4 điểm số cũ (tương thích ngược)
  ratings?: EvaluationRatings;
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  comment?: string;

  // AI suggestion fields (tuỳ chọn — gửi kèm khi Leader lưu sau khi xem AI gợi ý)
  aiRatings?: EvaluationRatings;
  aiCommunication?: number;
  aiAttitude?: number;
  aiLearning?: number;
  aiCoding?: number;
  aiComment?: string;
}

export interface UpdateWeeklyEvaluationDto {
  ratings?: EvaluationRatings;
  communication?: number;
  attitude?: number;
  learning?: number;
  coding?: number;
  comment?: string | null;
}

// ─── AI Suggestion ──────────────────────────────────────────────────────────

export interface AiSuggestionRequestDto {
  internId: string;
  week: number;
}

/**
 * Schema JSON mà Gemini phải trả về (định dạng mới với 12 xếp loại).
 */
export interface GeminiEvaluationJson {
  ratings: EvaluationRatings;
  comment: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

/**
 * Response trả về cho client sau khi AI đã phân tích.
 */
export interface AiSuggestionResponseDto {
  ratings: EvaluationRatings;
  // Tính toán từ ratings để client có thể preview
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  totalScore: number;
  comment: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  dataUsed: {
    dailyReportsCount: number;
    taskSubmissionsCount: number;
    weekRange: {
      from: string; // ISO date string
      to: string;   // ISO date string
    };
  };
}
