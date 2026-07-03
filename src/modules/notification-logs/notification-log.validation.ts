import { z } from 'zod';

export const findAllNotificationLogSchema = z.object({
  notificationId: z.string().uuid().optional(),
  channel: z.enum(['WEB', 'EMAIL', 'DISCORD']).optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  sortBy: z.enum(['sentAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createNotificationLogSchema = z.object({
  notificationId: z.string().uuid(),
  channel: z.enum(['WEB', 'EMAIL', 'DISCORD']),
  status: z.enum(['SUCCESS', 'FAILED']),
});

export const updateNotificationLogSchema = z.object({
  channel: z.enum(['WEB', 'EMAIL', 'DISCORD']).optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
});
