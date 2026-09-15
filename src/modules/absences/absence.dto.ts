import { AbsenceStatus } from "@prisma/client";

export interface CreateAbsenceDto {
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  evidenceUrl?: string;
}

export interface ReviewAbsenceDto {
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
}

export interface AbsenceQueryDto {
  status?: AbsenceStatus;
  userId?: string;
  startDate?: string;
  endDate?: string;
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
  reason: string;
  evidenceUrl: string | null;
  status: AbsenceStatus;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  reviewNote: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  user?: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  };
  reviewer?: {
    id: string;
    email: string | null;
    fullName: string | null;
  } | null;
}
