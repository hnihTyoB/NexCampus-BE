import { z } from 'zod';
import { SYSTEM_CONFIG_CATEGORY } from '../../common/constants/system-config.constant';

export const createSystemConfigSchema = z.object({
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(100, 'Key must not exceed 100 characters')
    .regex(/^[a-z0-9_.-]+$/i, 'Key must contain only letters, numbers, dots, hyphens, and underscores'),
  value: z.any({ required_error: 'Value is required' }),
  description: z.string().max(255).optional(),
  category: z.enum([
    SYSTEM_CONFIG_CATEGORY.GENERAL,
    SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    SYSTEM_CONFIG_CATEGORY.SECURITY,
  ]).optional().default(SYSTEM_CONFIG_CATEGORY.GENERAL),
  isPublic: z.boolean().optional().default(false),
});

export const updateSystemConfigSchema = z.object({
  value: z.any().optional(),
  description: z.string().max(255).optional(),
  category: z.enum([
    SYSTEM_CONFIG_CATEGORY.GENERAL,
    SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    SYSTEM_CONFIG_CATEGORY.SECURITY,
  ]).optional(),
  isPublic: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field to update must be provided',
});

export const toggleFeatureFlagSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled boolean state is required' }),
  description: z.string().max(255).optional(),
});

export const configKeyParamSchema = z.object({
  key: z.string().min(1, 'Key is required'),
});

export const configIdParamSchema = z.object({
  id: z.string().uuid('Invalid Config ID format (UUID expected)'),
});

export const querySystemConfigsSchema = z.object({
  category: z.string().optional(),
  isPublic: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional(),
});
