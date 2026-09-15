import { z } from "zod";
import { ReviewStatus } from "@prisma/client";

export const submissionIdParamSchema = z.object({
  id: z.string().uuid("Invalid submission ID"),
});

export const attachmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid submission ID"),
  attachmentId: z.string().uuid("Invalid attachment ID"),
});

export const findAllSubmissionSchema = z.object({
  assignmentId: z.string().uuid().optional(),
  internId: z.string().uuid().optional(),
  reviewStatus: z.enum([ReviewStatus.PENDING, ReviewStatus.APPROVED, ReviewStatus.REJECTED]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(["submittedAt", "attempt"]).optional().default("submittedAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const submissionAttachmentItemSchema = z.object({
  fileName: z.string().trim().min(1, "fileName is required"),
  fileUrl: z.string().trim().min(1, "fileUrl is required"),
  filePath: z.string().trim().min(1, "filePath is required"),
  mimeType: z.string().trim().min(1, "mimeType is required"),
  fileSize: z.coerce.number().int().positive("fileSize must be positive"),
});

export const createSubmissionSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignmentId"),
  prLink: z.string().trim().url("prLink must be a valid URL").optional().or(z.literal("")),
  videoDemo: z.string().trim().optional(),
  note: z.string().trim().max(3000, "note cannot exceed 3000 characters").optional(),
  attachments: z.array(submissionAttachmentItemSchema).optional(),
});

export const reviewSubmissionSchema = z
  .object({
    reviewStatus: z.enum([ReviewStatus.APPROVED, ReviewStatus.REJECTED], {
      errorMap: () => ({ message: "reviewStatus must be APPROVED or REJECTED" }),
    }),
    reviewComment: z.string().trim().max(3000).optional(),
  })
  .refine(
    (data) => {
      if (data.reviewStatus === ReviewStatus.REJECTED) {
        return !!data.reviewComment && data.reviewComment.trim().length > 0;
      }
      return true;
    },
    {
      message: "Nhận xét lý do cần sửa (reviewComment) là bắt buộc khi yêu cầu làm lại (REJECTED)",
      path: ["reviewComment"],
    },
  );

export const getSubmissionUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "fileName is required"),
  mimeType: z.string().trim().min(1, "mimeType is required"),
});

export const addAttachmentSchema = submissionAttachmentItemSchema;
