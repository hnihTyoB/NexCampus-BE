export interface WeeklyEvaluationQueryDto {
  internId?: string;
  leaderId?: string;
  week?: number;
  sortBy?: 'week' | 'totalScore' | 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateWeeklyEvaluationDto {
  internId: string;
  week: number;
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  comment?: string;

  // AI suggestion fields (tuỳ chọn — gửi kèm khi Leader lưu sau khi xem AI gợi ý)
  aiCommunication?: number;
  aiAttitude?: number;
  aiLearning?: number;
  aiCoding?: number;
  aiComment?: string;
}

export interface UpdateWeeklyEvaluationDto {
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
 * Schema JSON mà Gemini phải trả về.
 * Lưu ý: trường này chỉ dùng nội bộ để parse response.
 */
export interface GeminiEvaluationJson {
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
  comment: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

/**
 * Response trả về cho client sau khi AI đã phân tích.
 */
export interface AiSuggestionResponseDto {
  communication: number;
  attitude: number;
  learning: number;
  coding: number;
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
