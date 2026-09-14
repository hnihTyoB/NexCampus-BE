export const MAX_LEADER_DEPARTMENTS = 3;

export interface LeaderDepartmentDto {
  id: string;
  name: string;
}

export interface LeaderUserDto {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface LeaderInternDto {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  startDate: Date;
  duration: number;
}

export interface LeaderDto {
  id: string;
  userId: string;
  position: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: LeaderUserDto;
  departments: LeaderDepartmentDto[];
  departmentId?: string | null;
  department?: LeaderDepartmentDto | null;
  internCount: number;
  interns?: LeaderInternDto[];
}

export interface LeaderQueryDto {
  fullName?: string;
  departmentId?: string;
  department?: string;
  isActive?: boolean;
  sortBy?: "createdAt" | "fullName";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateLeaderDto {
  userId: string;
  departmentIds?: string[];
  departmentId?: string;
  position?: string;
  phone?: string;
}

export interface UpdateLeaderDto {
  departmentIds?: string[];
  departmentId?: string | null;
  position?: string | null;
  phone?: string;
}

export interface UpdateMeLeaderDto {
  phone?: string | null;
}
