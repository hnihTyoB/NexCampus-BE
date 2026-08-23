import { NotificationChannel } from '../../common/constants/notification.constant';

export interface ListNotificationsDto {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

export interface NotificationItemDto {
  id: string;
  type: string;
  priority: string;
  title: string;
  content: string;
  actionUrl: string | null;
  metadata: unknown;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface ListNotificationsResponseDto {
  items: NotificationItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}

// ─────────────────────────────────────────────
// Admin Notification DTOs
// ─────────────────────────────────────────────

export interface SendNotificationDto {
  userIds: string[];
  channels: NotificationChannel[];
  title: string;
  content: string;
  type?: string;
  priority?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  templateKey?: string;
  templateData?: Record<string, unknown>;
}

export interface BroadcastNotificationDto {
  title: string;
  content: string;
  type?: string;
  priority?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ListEmailsDto {
  page?: number;
  limit?: number;
  status?: string;
  toEmail?: string;
}

export interface EmailItemDto {
  id: string;
  userId: string | null;
  toEmail: string;
  subject: string;
  templateKey: string;
  templateData: unknown;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListEmailsResponseDto {
  items: EmailItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateNotificationTemplateDto {
  code: string;
  name: string;
  description?: string;
  channels: NotificationChannel[];
  subject?: string;
  title?: string;
  content: string;
  variables: string[];
  isActive?: boolean;
}

export interface UpdateNotificationTemplateDto {
  name?: string;
  description?: string;
  channels?: NotificationChannel[];
  subject?: string;
  title?: string;
  content?: string;
  variables?: string[];
  isActive?: boolean;
}

export interface ListNotificationTemplatesDto {
  page?: number;
  limit?: number;
  channel?: string;
  isActive?: boolean;
  search?: string;
}

export interface NotificationTemplateItemDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  channels: unknown;
  subject: string | null;
  title: string | null;
  content: string;
  variables: unknown;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListNotificationTemplatesResponseDto {
  items: NotificationTemplateItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PreviewNotificationTemplateDto {
  variables: Record<string, unknown>;
}

export interface PreviewNotificationTemplateResponseDto {
  code: string;
  subject: string | null;
  title: string | null;
  content: string;
  html?: string;
}

export interface TestSendNotificationTemplateDto {
  toEmail?: string;
  variables: Record<string, unknown>;
  channels?: NotificationChannel[];
}
