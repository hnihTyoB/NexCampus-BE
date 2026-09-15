import { EvaluationGrade } from "@prisma/client";

export type RatingLevel = "TOT" | "KHA" | "TB" | "TBY" | "YEU";

export interface EvaluationRatings {
  // Nhóm I: Kỷ luật & tư chất
  ruleCompliance: RatingLevel;
  workAttitude: RatingLevel;
  learningCapacity: RatingLevel;
  pressureTolerance: RatingLevel;
  communication: RatingLevel;

  // Nhóm II: Chuyên môn
  knowledge: RatingLevel;
  practicalSkill: RatingLevel;
  languageProficiency: RatingLevel;
  teamwork: RatingLevel;
  creativity: RatingLevel;

  // Nhóm III: Kết quả đề tài
  contentRequirement: RatingLevel;
  progressRequirement: RatingLevel;
}

export interface WeeklyEvaluationDto {
  id: string;
  internId: string;
  leaderId: string;
  week: number;
  year: number;
  startDate: Date | string | null;
  endDate: Date | string | null;
  ratings: EvaluationRatings;
  score: number;
  grade: EvaluationGrade | null;
  comment: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  aiScore?: number | null;
  aiRatings?: EvaluationRatings | null;
  aiComment?: string | null;
  aiStrengths?: string[];
  aiWeaknesses?: string[];
  aiRecommendations?: string[];
  isAiAdjusted: boolean;
  viewedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  intern?: {
    id: string;
    fullName: string;
    internCode?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
    position?: {
      id: string;
      name: string;
    } | null;
    user?: {
      id: string;
      email: string;
      fullName: string | null;
      avatarUrl?: string | null;
    };
  };
  leader?: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl?: string | null;
  };
}

export interface CreateWeeklyEvaluationDto {
  internId: string;
  week: number;
  year?: number;
  ratings: EvaluationRatings;
  comment?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];

  // Optional AI suggestions tracked when leader saves
  aiRatings?: EvaluationRatings;
  aiScore?: number;
  aiComment?: string | null;
  aiStrengths?: string[];
  aiWeaknesses?: string[];
  aiRecommendations?: string[];
}

export interface UpdateWeeklyEvaluationDto {
  ratings?: EvaluationRatings;
  comment?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

export interface WeeklyEvaluationQueryDto {
  page?: number;
  limit?: number;
  week?: number;
  year?: number;
  internId?: string;
  leaderId?: string;
  departmentId?: string;
  sortBy?: "week" | "score" | "createdAt";
  order?: "asc" | "desc";
}

export interface AiSuggestRequestDto {
  internId: string;
  week: number;
}

export interface AiSuggestResponseDto {
  ratings: EvaluationRatings;
  score: number;
  grade: EvaluationGrade;
  comment: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  dataUsed: {
    dailyReportsCount: number;
    taskSubmissionsCount: number;
    weekRange: {
      from: string;
      to: string;
    };
  };
}

export interface InternEvaluationSummaryDto {
  internId: string;
  internName: string;
  totalEvaluations: number;
  avgScore: number;
  overallGrade: EvaluationGrade | null;
  viewedCount: number;
  unviewedCount: number;
  trend: "IMPROVING" | "DECLINING" | "STABLE";
  recentWeeks: Array<{
    id: string;
    week: number;
    year: number;
    score: number;
    grade: EvaluationGrade | null;
    viewedAt: Date | string | null;
    comment: string | null;
    createdAt: Date | string;
  }>;
}
