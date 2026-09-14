import { InternStatus } from "../../common/constants/intern.constant";

export interface InternUserDto {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
}

export interface InternDto {
  id: string;
  userId: string;
  leaderId: string | null;
  fullName: string;
  phone: string;
  internCode: string | null;
  university: string | null;
  major: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  startDate: Date;
  duration: number;
  discordUsername: string | null;
  discordRoleGranted: boolean;
  status: InternStatus;
  createdAt: Date;
  updatedAt: Date;
  user: InternUserDto;
  leader: InternUserDto | null;
}

export interface InternQueryDto {
  search?: string;
  internCode?: string;
  fullName?: string;
  university?: string;
  major?: string;
  departmentId?: string;
  positionId?: string;
  department?: string;
  position?: string;
  status?: InternStatus;
  leaderId?: string;
  leader?: string;
  discordRoleGranted?: boolean;
  startDateFrom?: string;
  startDateTo?: string;

  sortBy?: "createdAt" | "fullName" | "startDate" | "status" | "internCode";
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
  duration?: number;
  discordUsername?: string;
  internCode?: string;
  university?: string;
  major?: string;
}

export interface DirectCreateInternDto {
  email: string;
  leaderId?: string;
  fullName: string;
  phone: string;
  departmentId: string;
  positionId: string;
  startDate: string;
  duration?: number;
  discordUsername?: string;
  internCode?: string;
  university?: string;
  major?: string;
}

export interface UpdateInternDto {
  leaderId?: string | null;
  fullName?: string;
  phone?: string;
  departmentId?: string | null;
  positionId?: string | null;
  startDate?: string;
  duration?: number;
  discordUsername?: string | null;
  discordRoleGranted?: boolean;
  status?: InternStatus;
  internCode?: string | null;
  university?: string | null;
  major?: string | null;
}

export interface UpdateMeInternDto {
  phone?: string;
  departmentId?: string;
  positionId?: string;
  discordUsername?: string | null;
  university?: string | null;
  major?: string | null;
}

export interface AssignLeaderDto {
  leaderId: string | null;
}
