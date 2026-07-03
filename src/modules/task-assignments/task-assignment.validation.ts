import { z } from 'zod';

export const findAllAssignmentSchema = z.object({
  taskId: z.string().uuid().optional(),
  internId: z.string().uuid().optional(),
  assignedBy: z.string().uuid().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  sortBy: z.enum(['assignedAt', 'status']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createAssignmentSchema = z.object({
  taskId: z.string().uuid(),
  internId: z.string().uuid(),
});

export const updateAssignmentSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  internId: z.string().uuid().optional(),
}).refine(data => data.status !== undefined || data.internId !== undefined, {
  message: 'At least one field (status or internId) must be provided for update',
});
