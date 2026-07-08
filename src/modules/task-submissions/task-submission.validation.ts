import { z } from "zod";
import { validateUrl } from "../../common/helpers/url.helper";

const isPublicUrl = (val: string | null | undefined) => {
  if (!val) return true;
  try {
    validateUrl(val);
    return true;
  } catch {
    return false;
  }
};

export const findAllSubmissionSchema = z.object({
  assignmentId: z.string().uuid().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  reviewedBy: z.string().uuid().optional(),
  internId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  sortBy: z.enum(["submittedAt", "reviewStatus", "attempt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  prLink: z.string().url().refine(isPublicUrl, { message: "URL cannot be a private or local address" }).optional().or(z.literal("")),
  videoDemo: z.string().url().refine(isPublicUrl, { message: "URL cannot be a private or local address" }).optional().or(z.literal("")),
  note: z.string().max(1000).optional(),
});

export const updateSubmissionSchema = z.object({
  prLink: z.string().url().nullable().refine(isPublicUrl, { message: "URL cannot be a private or local address" }).optional().or(z.literal("")),
  videoDemo: z.string().url().nullable().refine(isPublicUrl, { message: "URL cannot be a private or local address" }).optional().or(z.literal("")),
  note: z.string().max(1000).nullable().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  reviewComment: z.string().max(1000).nullable().optional(),
});

