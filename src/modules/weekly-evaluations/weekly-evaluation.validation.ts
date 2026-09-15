import { z } from "zod";

export const ratingLevelSchema = z.enum(["TOT", "KHA", "TB", "TBY", "YEU"], {
  errorMap: () => ({
    message: "Mức xếp loại phải là một trong các giá trị: TOT, KHA, TB, TBY, YEU",
  }),
});

export const ratingsSchema = z.object({
  // Nhóm I: Kỷ luật & tư chất
  ruleCompliance: ratingLevelSchema,
  workAttitude: ratingLevelSchema,
  learningCapacity: ratingLevelSchema,
  pressureTolerance: ratingLevelSchema,
  communication: ratingLevelSchema,

  // Nhóm II: Chuyên môn
  knowledge: ratingLevelSchema,
  practicalSkill: ratingLevelSchema,
  languageProficiency: ratingLevelSchema,
  teamwork: ratingLevelSchema,
  creativity: ratingLevelSchema,

  // Nhóm III: Kết quả đề tài
  contentRequirement: ratingLevelSchema,
  progressRequirement: ratingLevelSchema,
});

export const createWeeklyEvaluationSchema = z.object({
  internId: z.string().uuid("Intern ID không hợp lệ"),
  week: z.coerce.number().int().min(1, "Tuần đánh giá phải từ 1 trở lên"),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  ratings: ratingsSchema,
  comment: z.string().trim().max(2000, "Nhận xét tối đa 2000 ký tự").optional().nullable(),
  strengths: z.array(z.string().trim()).optional(),
  weaknesses: z.array(z.string().trim()).optional(),
  recommendations: z.array(z.string().trim()).optional(),

  // AI suggestion metadata
  aiRatings: ratingsSchema.optional(),
  aiScore: z.number().min(0).max(10).optional(),
  aiComment: z.string().trim().optional().nullable(),
  aiStrengths: z.array(z.string().trim()).optional(),
  aiWeaknesses: z.array(z.string().trim()).optional(),
  aiRecommendations: z.array(z.string().trim()).optional(),
});

export const updateWeeklyEvaluationSchema = z.object({
  ratings: ratingsSchema.optional(),
  comment: z.string().trim().max(2000).optional().nullable(),
  strengths: z.array(z.string().trim()).optional(),
  weaknesses: z.array(z.string().trim()).optional(),
  recommendations: z.array(z.string().trim()).optional(),
});

export const aiSuggestSchema = z.object({
  internId: z.string().uuid("Intern ID không hợp lệ"),
  week: z.coerce.number().int().min(1, "Tuần đánh giá phải từ 1 trở lên"),
});

export const queryWeeklyEvaluationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  week: z.coerce.number().int().min(1).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  internId: z.string().uuid("Intern ID không hợp lệ").optional(),
  leaderId: z.string().uuid("Leader ID không hợp lệ").optional(),
  departmentId: z.string().uuid("Department ID không hợp lệ").optional(),
  sortBy: z.enum(["week", "score", "createdAt"]).default("week"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateWeeklyEvaluationInput = z.infer<typeof createWeeklyEvaluationSchema>;
export type UpdateWeeklyEvaluationInput = z.infer<typeof updateWeeklyEvaluationSchema>;
export type AiSuggestInput = z.infer<typeof aiSuggestSchema>;
export type QueryWeeklyEvaluationInput = z.infer<typeof queryWeeklyEvaluationSchema>;
