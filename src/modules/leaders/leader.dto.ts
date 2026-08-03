export const MAX_LEADER_DEPARTMENTS = 3;

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
  /** @deprecated Use departmentIds. */
  departmentId?: string;
  position?: string;
  phone?: string;
}

export interface UpdateLeaderDto {
  departmentIds?: string[];
  /** @deprecated Use departmentIds. */
  departmentId?: string | null;
  position?: string | null;
  phone?: string;
}

export interface UpdateMeLeaderDto {
  phone?: string | null;
}
