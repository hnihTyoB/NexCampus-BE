import { z } from "zod";

export const queryActivityLogSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  actorId: z.string().uuid("Actor ID không hợp lệ").optional(),
  action: z.string().trim().optional(),
  targetType: z.string().trim().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "Định dạng ngày bắt đầu: YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "Định dạng ngày kết thúc: YYYY-MM-DD")
    .optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const activityLogIdParamSchema = z.object({
  id: z.string().uuid("Activity log ID không hợp lệ"),
});

export type QueryActivityLogInput = z.infer<typeof queryActivityLogSchema>;
export const activityLogQuerySchema = queryActivityLogSchema;
