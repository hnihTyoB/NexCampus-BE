import { z } from "zod";

export const exportWeeklyEvaluationParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export const exportInternshipSummaryParamSchema = z.object({
  internId: z.string().uuid("internId must be a valid UUID"),
});

export type ExportWeeklyEvaluationParamInput = z.infer<
  typeof exportWeeklyEvaluationParamSchema
>;
export type ExportInternshipSummaryParamInput = z.infer<
  typeof exportInternshipSummaryParamSchema
>;
