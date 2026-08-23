import { z } from 'zod';
import { isPublicHttpUrl } from '../../common/helpers/url.helper';

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

export const templateIdParamSchema = z.object({
  id: z.string().uuid('Invalid template ID'),
});

export const templateCodeParamSchema = z.object({
  code: z.string().min(1, 'Template code is required'),
});

export const sendNotificationSchema = z.object({
  userIds: z.array(z.string().uuid('Invalid user ID')).min(1, 'At least one userId is required'),
  channels: z.array(z.enum(['WEB', 'EMAIL'])).min(1, 'At least one channel is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['SYSTEM', 'ALERT', 'INFO', 'SUCCESS', 'WARNING']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  actionUrl: z
    .string()
    .refine(
      (url) => isPublicHttpUrl(url),
      'actionUrl must be a valid public HTTPS URL (private IP and localhost are not allowed in production)',
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  templateKey: z.string().optional(),
  templateData: z.record(z.unknown()).optional(),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['SYSTEM', 'ALERT', 'INFO', 'SUCCESS', 'WARNING']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  actionUrl: z
    .string()
    .refine(
      (url) => isPublicHttpUrl(url),
      'actionUrl must be a valid public HTTPS URL (private IP and localhost are not allowed in production)',
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listEmailsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED']).optional(),
  toEmail: z.string().optional(),
});

export const createNotificationTemplateSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(100)
    .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(500).optional(),
  channels: z.array(z.enum(['WEB', 'EMAIL'])).min(1, 'At least one channel is required'),
  subject: z.string().optional(),
  title: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().max(500).optional(),
  channels: z.array(z.enum(['WEB', 'EMAIL'])).min(1, 'At least one channel is required').optional(),
  subject: z.string().optional(),
  title: z.string().optional(),
  content: z.string().min(1, 'Content cannot be empty').optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const listNotificationTemplatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channel: z.enum(['WEB', 'EMAIL']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});

export const previewNotificationTemplateSchema = z.object({
  variables: z.record(z.unknown()).default({}),
});

export const testSendNotificationTemplateSchema = z.object({
  toEmail: z.string().email('Invalid email address').optional(),
  variables: z.record(z.unknown()).default({}),
  channels: z.array(z.enum(['WEB', 'EMAIL'])).optional(),
});
