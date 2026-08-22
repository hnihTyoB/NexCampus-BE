import { z } from 'zod';

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  type: z.string().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

export const emailIdParamSchema = z.object({
  id: z.string().uuid('Invalid email ID'),
});

export const sendNotificationSchema = z.object({
  userIds: z.array(z.string().uuid('Invalid user ID')).min(1, 'At least one userId is required'),
  channels: z.array(z.enum(['WEB', 'EMAIL'])).min(1, 'At least one channel is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['SYSTEM', 'ALERT', 'INFO', 'SUCCESS', 'WARNING']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  actionUrl: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  templateKey: z.enum(['VERIFY_EMAIL', 'RESET_PASSWORD', 'NEW_DEVICE_ALERT', 'CUSTOM']).optional(),
  templateData: z.record(z.unknown()).optional(),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['SYSTEM', 'ALERT', 'INFO', 'SUCCESS', 'WARNING']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  actionUrl: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listEmailsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  toEmail: z.string().optional(),
});
