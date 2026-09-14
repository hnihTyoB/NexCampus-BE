import {
  ApplicationStatus,
  ApplicationInviteStatus,
} from "../../common/constants/application.constant";

export interface ApplicationAttachmentDto {
  id: string;
  applicationId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
}

export interface ApplicationDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  university: string | null;
  major: string | null;
  cvUrl: string | null;
  preferredDepartment: string | null;
  preferredPosition: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  startDate: Date;
  duration: number;
  status: ApplicationStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  regulationId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approver?: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl?: string | null;
  } | null;
  rejecter?: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl?: string | null;
  } | null;
  attachments?: ApplicationAttachmentDto[];
}

export interface ApplicationInviteDto {
  id: string;
  email: string;
  token: string;
  status: ApplicationInviteStatus;
  expiresAt: Date;
  usedAt: Date | null;
  applicationId?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  application?: {
    id: string;
    fullName: string;
    status: ApplicationStatus;
  } | null;
}

export interface ApplicationQueryDto {
  search?: string;
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

export interface GetApplicationInvitesQuery {
  email?: string;
  status?: ApplicationInviteStatus;
  inviteStatus?: ApplicationInviteStatus;
  applicationStatus?: ApplicationStatus;
  departmentId?: string;
  positionId?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: "createdAt" | "expiresAt" | "email";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateInviteDto {
  email: string;
}

export interface CreateApplicationDto {
  fullName: string;
  email: string;
  phone: string;
  university?: string;
  major?: string;
  preferredDepartment: string;
  preferredPosition: string;
  startDate: string;
  duration?: number;
  token: string;
  regulationId?: string;
  acceptedRegulations: boolean;
  cvUrl?: string;
  uploadedFiles?: Array<{
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  }>;
}

export interface AssignApplicationDto {
  departmentId: string | null;
  positionId: string | null;
}

export interface ApproveApplicationDto {
  leaderId?: string;
}

export interface RejectApplicationDto {
  rejectedReason: string;
}

export interface ReviewApplicationDto {
  status: "APPROVED" | "REJECTED";
  rejectedReason?: string;
  leaderId?: string;
}
