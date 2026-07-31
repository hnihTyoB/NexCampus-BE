import { InternStatus } from "@prisma/client";

export interface InternQueryDto {
  fullName?: string;
  departmentId?: string;
  positionId?: string;
  status?: InternStatus;
  leaderId?: string;
  leader?: string;
  discordRoleGranted?: boolean;
  startDateFrom?: string;
  startDateTo?: string;

  sortBy?: "createdAt" | "fullName" | "startDate" | "status";
  order?: "asc" | "desc";

  page?: number;
  limit?: number;
}

export interface CreateInternDto {
  userId: string;
  leaderId?: string;
  fullName: string;
  phone: string;
  departmentId: string;
  positionId: string;
  startDate: string;
  duration: number;
  discordUsername?: string;
}

export interface DirectCreateInternDto {
  email: string;
  leaderId?: string;
  fullName: string;
  phone: string;
  departmentId: string;
  positionId: string;
  startDate: string;
  duration: number;
  discordUsername?: string;
}

export interface UpdateInternDto {
  leaderId?: string | null;
  fullName?: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  startDate?: string;
  duration?: number;
  discordUsername?: string | null;
  discordRoleGranted?: boolean;
  status?: InternStatus;
}

export interface UpdateMeInternDto {
  phone?: string;
  departmentId?: string;
  positionId?: string;
  discordUsername?: string | null;
}
