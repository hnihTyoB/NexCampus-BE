import { ActivityAction } from "../../common/constants/activity-log.constant";

export interface ActivityLogQueryDto {
  userId?: string;
  action?: ActivityAction;
  targetId?: string;
  targetType?: string;
  sortBy?: "createdAt";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateActivityLogDto {
  userId: string;
  action: ActivityAction;
  targetId?: string;
  targetType?: string;
  description: string;
}
