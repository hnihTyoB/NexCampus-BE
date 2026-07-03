import { z } from 'zod';

export const findAllInternSchema = z.object({
  fullName:   z.string().optional(),
  department: z.string().optional(),
  position:   z.string().optional(),
  status:     z.enum(['ACTIVE', 'COMPLETED', 'DROPPED']).optional(),
  leaderId:   z.string().uuid('Invalid leaderId').optional(),
  discordRoleGranted: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  startDateFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'startDateFrom must be a valid ISO date' })
    .optional(),
  startDateTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'startDateTo must be a valid ISO date' })
    .optional(),

  sortBy: z.enum(['createdAt', 'fullName', 'startDate', 'status']).optional(),
  order:  z.enum(['asc', 'desc']).optional(),

  page:  z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createInternSchema = z.object({
  userId:    z.string().uuid('Invalid userId'),
  leaderId:  z.string().uuid('Invalid leaderId').optional(),
  fullName:  z.string().min(1, 'Full name is required').max(100),
  phone:     z.string().min(9).max(15),
  department: z.string().min(1, 'Department is required'),
  position:   z.string().min(1, 'Position is required'),
  startDate:  z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'startDate must be a valid ISO date',
  }),
  duration:       z.number().int().positive('Duration must be a positive integer'),
  discordUsername: z.string().optional(),
});

export const updateInternSchema = z.object({
  leaderId:           z.string().uuid().nullable().optional(),
  fullName:           z.string().min(1).max(100).optional(),
  phone:              z.string().min(9).max(15).optional(),
  department:         z.string().optional(),
  position:           z.string().optional(),
  startDate:          z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }).optional(),
  duration:           z.number().int().positive().optional(),
  discordUsername:    z.string().nullable().optional(),
  discordRoleGranted: z.boolean().optional(),
  status:             z.enum(['ACTIVE', 'COMPLETED', 'DROPPED']).optional(),
});
