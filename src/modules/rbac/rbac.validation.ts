import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên vai trò tối thiểu 2 ký tự')
    .max(50, 'Tên vai trò tối đa 50 ký tự')
    .regex(/^[A-Z0-9_]+$/, 'Tên vai trò chỉ được gồm chữ hoa, số và dấu gạch dưới (VD: ACCOUNTANT, AUDITOR)'),
  description: z.string().max(255, 'Mô tả tối đa 255 ký tự').optional(),
  permissionIds: z.array(z.string().uuid('Permission ID không hợp lệ')).optional(),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên vai trò tối thiểu 2 ký tự')
    .max(50, 'Tên vai trò tối đa 50 ký tự')
    .regex(/^[A-Z0-9_]+$/, 'Tên vai trò chỉ được gồm chữ hoa, số và dấu gạch dưới')
    .optional(),
  description: z.string().max(255, 'Mô tả tối đa 255 ký tự').optional(),
});

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid('Permission ID không hợp lệ')).min(1, 'Cần ít nhất một permission ID'),
});

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid('Role ID không hợp lệ'),
});

export const roleIdParamSchema = z.object({
  id: z.string().uuid('Role ID không hợp lệ'),
});

export const rolePermissionParamsSchema = z.object({
  id: z.string().uuid('Role ID không hợp lệ'),
  permissionId: z.string().uuid('Permission ID không hợp lệ'),
});

export const roleQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const auditLogQuerySchema = z.object({
  actorId: z.string().uuid('Actor ID không hợp lệ').optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
