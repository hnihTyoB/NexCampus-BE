import { z } from "zod";
import { AbsenceStatus } from "@prisma/client";

export const absenceIdParamSchema = z.object({
  id: z.string().uuid("Invalid absence ID"),
});

export const findAllAbsenceSchema = z.object({
  status: z.nativeEnum(AbsenceStatus).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  sortBy: z.enum(["startDate", "createdAt"]).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createAbsenceSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(1, "Lý do xin vắng mặt là bắt buộc").max(3000),
    evidenceUrl: z.string().trim().url("evidenceUrl must be a valid URL").optional().or(z.literal("")),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Ngày bắt đầu (startDate) phải trước hoặc bằng ngày kết thúc (endDate)",
    path: ["endDate"],
  });

export const reviewGeneralAbsenceSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    errorMap: () => ({ message: "status must be APPROVED or REJECTED" }),
  }),
  reviewNote: z.string().trim().max(2000).optional(),
});
