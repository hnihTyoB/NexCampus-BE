import { z } from 'zod';

export const findAllDailyReportSchema = z.object({
  internId: z.string().uuid().optional(),
  createdAtFrom: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid createdAtFrom' }).optional(),
  createdAtTo: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid createdAtTo' }).optional(),
  sortBy: z.enum(['createdAt', 'internId']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createDailyReportSchema = z.object({
  content: z.string().min(1).max(5000),
  prLink: z.string().url().optional().or(z.literal('')),
  videoDemo: z.string().url().optional().or(z.literal('')),
});

export const updateDailyReportSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  prLink: z.string().url().nullable().optional().or(z.literal('')),
  videoDemo: z.string().url().nullable().optional().or(z.literal('')),
});
