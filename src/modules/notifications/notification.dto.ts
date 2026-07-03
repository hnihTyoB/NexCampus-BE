export interface NotificationQueryDto {
  userId?: string;
  isRead?: boolean;
  type?: string;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateNotificationDto {
  userId: string;
  title: string;
  content: string;
  type: string;
}
