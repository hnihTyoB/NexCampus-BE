import { AbsenceDuration, AbsenceReasonType, AbsenceStatus } from "@prisma/client";

export interface CreateAbsenceDto {
  startDate: Date | string;
  endDate: Date | string;
  durationUnit?: AbsenceDuration;
  reasonType?: AbsenceReasonType;
  reason: string;
  evidenceUrl?: string | null;
}

export interface ReviewAbsenceDto {
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
  autoExtendConflictTasks?: boolean;
  extendDays?: number;
}

export interface TaskConflictDto {
  taskId: string;
  code: string | null;
  title: string;
  deadline: Date | string | null;
  status: string;
  priority: string;
}

export interface AbsenceQueryDto {
  status?: AbsenceStatus;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "startDate" | "createdAt";
  order?: "asc" | "desc";
}

export interface AbsenceDto {
  id: string;
  userId: string;
  startDate: Date | string;
  endDate: Date | string;
  durationUnit: AbsenceDuration;
  reasonType: AbsenceReasonType;
  reason: string;
  evidenceUrl: string | null;
  status: AbsenceStatus;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  reviewNote: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  conflictTasks?: TaskConflictDto[];
  user?: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    intern?: {
      id: string;
      internCode: string | null;
      leaderId: string | null;
      department?: {
        id: string;
        name: string;
      } | null;
    } | null;
  };
  reviewer?: {
    id: string;
    email: string | null;
    fullName: string | null;
  } | null;
}

export interface AbsencePresignedUrlResponseDto {
  uploadUrl: string;
  fileUrl: string;
  filePath: string;
  key: string;
}
