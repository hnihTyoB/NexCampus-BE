import { z } from 'zod';
import { MAINTENANCE_STATUS } from '../../common/constants/maintenance.constant';

export const enableMaintenanceSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(200, 'Title is too long').optional(),
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long').optional(),
  startAt: z
    .string()
    .datetime({ message: 'startAt must be a valid ISO 8601 datetime string' })
    .nullable()
    .optional(),
  estimatedEndAt: z
    .string()
    .datetime({ message: 'estimatedEndAt must be a valid ISO 8601 datetime string' })
    .nullable()
    .optional(),
  bypassPermissions: z
    .array(z.string().min(1, 'Permission name cannot be empty'))
    .optional(),
  bypassRoles: z
    .array(z.string().min(1, 'Role name cannot be empty'))
    .optional(),
  bypassIps: z
    .array(z.string().trim().min(1, 'IP address / subnet cannot be empty'))
    .optional(),
  status: z
    .enum([MAINTENANCE_STATUS.MAINTENANCE, MAINTENANCE_STATUS.READ_ONLY])
    .optional(),
});

export const updateMaintenanceSchema = z.object({
  enabled: z.boolean().optional(),
  status: z
    .enum([
      MAINTENANCE_STATUS.ONLINE,
      MAINTENANCE_STATUS.MAINTENANCE,
      MAINTENANCE_STATUS.READ_ONLY,
    ])
    .optional(),
  title: z.string().trim().min(1, 'Title cannot be empty').max(200, 'Title is too long').optional(),
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long').optional(),
  startAt: z
    .string()
    .datetime({ message: 'startAt must be a valid ISO 8601 datetime string' })
    .nullable()
    .optional(),
  estimatedEndAt: z
    .string()
    .datetime({ message: 'estimatedEndAt must be a valid ISO 8601 datetime string' })
    .nullable()
    .optional(),
  bypassPermissions: z
    .array(z.string().min(1, 'Permission name cannot be empty'))
    .optional(),
  bypassRoles: z
    .array(z.string().min(1, 'Role name cannot be empty'))
    .optional(),
  bypassIps: z
    .array(z.string().trim().min(1, 'IP address / subnet cannot be empty'))
    .optional(),
});
