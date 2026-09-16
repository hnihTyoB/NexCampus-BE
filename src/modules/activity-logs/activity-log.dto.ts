export interface ActivityLogActorDto {
  id: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface ActivityLogDto {
  id: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
  actor?: ActivityLogActorDto | null;
}

export interface CreateAuditLogInput {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  details?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface QueryActivityLogDto {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
  sortBy?: "createdAt";
  order?: "asc" | "desc";
}

export interface ActivityLogListResponseDto {
  items: ActivityLogDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
