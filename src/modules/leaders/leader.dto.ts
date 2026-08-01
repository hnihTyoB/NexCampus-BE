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
  departmentId?: string;
  position?: string;
  phone?: string;
}

export interface UpdateLeaderDto {
  departmentId?: string | null;
  position?: string | null;
  phone?: string;
}
