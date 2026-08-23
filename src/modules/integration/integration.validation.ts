import { z } from 'zod';
import { isPublicHttpUrl } from '../../common/helpers/url.helper';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  permissions: z.array(z.string()).optional().default([]),
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO 8601 datetime string' })
    .optional()
    .refine((val) => !val || new Date(val) > new Date(), {
      message: 'expiresAt must be a future date',
    }),
});

export const apiKeyIdParamSchema = z.object({
  id: z.string().uuid('Invalid API Key ID format'),
});

export const createWebhookSchema = z.object({
  url: z
    .string()
    .min(1, 'Webhook URL is required')
    .refine(
      (url) => isPublicHttpUrl(url),
      'Webhook URL must be a valid public HTTP/HTTPS URL (private IP and localhost are not allowed in production)',
    ),
  secret: z.string().min(16, 'Custom secret must be at least 16 characters').optional(),
  events: z.array(z.string()).min(1, 'At least one event or "*" is required').optional().default(['*']),
  description: z.string().max(255).optional(),
});

export const updateWebhookSchema = z.object({
  url: z
    .string()
    .refine(
      (url) => isPublicHttpUrl(url),
      'Webhook URL must be a valid public HTTP/HTTPS URL (private IP and localhost are not allowed in production)',
    )
    .optional(),
  events: z.array(z.string()).min(1, 'At least one event is required').optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(255).optional(),
  secret: z.string().min(16, 'Custom secret must be at least 16 characters').optional(),
});

export const webhookIdParamSchema = z.object({
  id: z.string().uuid('Invalid Webhook ID format'),
});

export const deliveryIdParamSchema = z.object({
  deliveryId: z.string().uuid('Invalid Delivery ID format'),
});

export const listDeliveriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED']).optional(),
  event: z.string().optional(),
});

export const triggerJobSchema = z.object({
  taskName: z.string().min(1, 'Task name is required'),
  data: z.record(z.unknown()).default({}),
  simulateError: z.boolean().optional().default(false),
});
