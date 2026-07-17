import { z } from "zod";

export const findAllLeaderSchema = z.object({
  fullName: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "fullName"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createLeaderSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
  departmentId: z.string().uuid().optional(),
  position: z.string().max(100).optional(),
  phone: z.string().max(15).optional(),
});

export const updateLeaderSchema = z.object({
  departmentId: z.string().uuid().nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  phone: z.string().max(15).optional(),
});
