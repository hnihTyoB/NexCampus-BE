import { InternStatus } from "@prisma/client";

export interface InternQueryDto {
  fullName?: string;
  department?: string;
  position?: string;
  status?: InternStatus;
  leaderId?: string;
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
  department: string;
  position: string;
  startDate: string;
  duration: number;
  discordUsername?: string;
}

export interface UpdateInternDto {
  leaderId?: string | null;
  fullName?: string;
  phone?: string;
  department?: string;
  position?: string;
  startDate?: string;
  duration?: number;
  discordUsername?: string | null;
  discordRoleGranted?: boolean;
  status?: InternStatus;
}
