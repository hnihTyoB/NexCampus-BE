import { NotificationChannel, NotificationLogStatus } from "@prisma/client";

export interface NotificationLogQueryDto {
  notificationId?: string;
  channel?: NotificationChannel;
  status?: NotificationLogStatus;
  sortBy?: "sentAt";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateNotificationLogDto {
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationLogStatus;
}

export interface UpdateNotificationLogDto {
  channel?: NotificationChannel;
  status?: NotificationLogStatus;
}
