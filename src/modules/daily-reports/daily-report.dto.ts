export interface DailyReportQueryDto {
  internId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  sortBy?: 'createdAt' | 'internId';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateDailyReportDto {
  content: string;
  prLink?: string;
  videoDemo?: string;
}

export interface UpdateDailyReportDto {
  content?: string;
  prLink?: string | null;
  videoDemo?: string | null;
}
