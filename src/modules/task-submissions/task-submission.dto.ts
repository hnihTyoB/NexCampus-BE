import { ReviewStatus } from '@prisma/client';

export interface TaskSubmissionQueryDto {
  assignmentId?: string;
  reviewStatus?: ReviewStatus;
  reviewedBy?: string;
  internId?: string;
  taskId?: string;
  sortBy?: 'submittedAt' | 'reviewStatus' | 'attempt';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateTaskSubmissionDto {
  assignmentId: string;
  prLink?: string;
  videoDemo?: string;
  note?: string;
}

export interface UpdateTaskSubmissionDto {
  prLink?: string | null;
  videoDemo?: string | null;
  note?: string | null;
  reviewStatus?: ReviewStatus;
  reviewComment?: string | null;
}
