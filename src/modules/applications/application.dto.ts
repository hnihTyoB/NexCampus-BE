import { ApplicationStatus } from "@prisma/client";

export interface ApplicationQueryDto {
  status?: ApplicationStatus;
  departmentId?: string;
  positionId?: string;
  email?: string;
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: "createdAt" | "startDate" | "fullName" | "status";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateApplicationDto {
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  positionId: string;
  startDate: string;
  duration: number;
  token: string;
  regulationId: string;
  acceptedRegulations: boolean;
}

export interface ReviewApplicationDto {
  status: "APPROVED" | "REJECTED";
}

export interface ApplicationResponseDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  startDate: Date;
  duration: number;
  status: ApplicationStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approver?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
  }>;
}

export interface CreateInviteDto {
  email: string;
}

export interface ApplicationInviteResponseDto {
  id: string;
  email: string;
  token: string;
  status: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetApplicationInvitesQuery {
  email?: string;
  inviteStatus?: string;
  applicationStatus?: string;
  departmentId?: string;
  positionId?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: "createdAt" | "expiresAt" | "email";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}
