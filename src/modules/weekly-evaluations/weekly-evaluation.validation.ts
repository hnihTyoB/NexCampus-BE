import { z } from "zod";

export const findAllWeeklyEvaluationSchema = z.object({
  internId: z.string().uuid().optional(),
  leaderId: z.string().uuid().optional(),
  week: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(["week", "totalScore", "createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createWeeklyEvaluationSchema = z.object({
  internId: z.string().uuid(),
  week: z.number().int().positive(),
  communication: z.number().min(0).max(10),
  attitude: z.number().min(0).max(10),
  learning: z.number().min(0).max(10),
  coding: z.number().min(0).max(10),
  comment: z.string().max(2000).optional(),

  // AI fields tuỳ chọn — gửi kèm khi Leader lưu sau khi xem AI gợi ý
  aiCommunication: z.number().min(0).max(10).optional(),
  aiAttitude: z.number().min(0).max(10).optional(),
  aiLearning: z.number().min(0).max(10).optional(),
  aiCoding: z.number().min(0).max(10).optional(),
  aiComment: z.string().max(5000).optional(),
});

export const updateWeeklyEvaluationSchema = z.object({
  communication: z.number().min(0).max(10).optional(),
  attitude: z.number().min(0).max(10).optional(),
  learning: z.number().min(0).max(10).optional(),
  coding: z.number().min(0).max(10).optional(),
  comment: z.string().max(2000).nullable().optional(),
});

// ─── AI Suggestion ──────────────────────────────────────────────────────────

export const aiSuggestionSchema = z.object({
  internId: z.string().uuid({ message: "internId phải là UUID hợp lệ" }),
  week: z.number().int().positive({ message: "week phải là số nguyên dương" }),
});
