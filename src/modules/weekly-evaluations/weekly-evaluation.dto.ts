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
}

export interface UpdateWeeklyEvaluationDto {
  communication?: number;
  attitude?: number;
  learning?: number;
  coding?: number;
  comment?: string | null;
}
