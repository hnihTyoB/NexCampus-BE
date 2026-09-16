import { z } from "zod";

export const adminStatsQuerySchema = z.object({
  departmentId: z.string().uuid("departmentId must be a valid UUID").optional(),
});

export const leaderStatsQuerySchema = z.object({
  departmentId: z.string().uuid("departmentId must be a valid UUID").optional(),
});

export const internStatsQuerySchema = z.object({
  internId: z.string().uuid("internId must be a valid UUID").optional(),
});

export type AdminStatsQueryInput = z.infer<typeof adminStatsQuerySchema>;
export type LeaderStatsQueryInput = z.infer<typeof leaderStatsQuerySchema>;
export type InternStatsQueryInput = z.infer<typeof internStatsQuerySchema>;
