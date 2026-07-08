import { ApplicationStatus } from "@prisma/client";

export interface ApplicationQueryDto {
  status?: ApplicationStatus;
  department?: string;
  position?: string;
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
  department: string;
  position: string;
  startDate: string;
  duration: number;
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
}
