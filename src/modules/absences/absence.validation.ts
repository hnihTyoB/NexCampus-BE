import { z } from "zod";
import { AbsenceDuration, AbsenceReasonType, AbsenceStatus } from "@prisma/client";

export const absenceIdParamSchema = z.object({
  id: z.string().uuid("ID đơn xin nghỉ không hợp lệ"),
});

export const findAllAbsenceSchema = z.object({
  status: z.nativeEnum(AbsenceStatus).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  search: z.string().trim().optional(),
  sortBy: z.enum(["startDate", "createdAt"]).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createAbsenceSchema = z
  .object({
    startDate: z.coerce.date({ required_error: "Vui lòng chọn ngày bắt đầu" }),
    endDate: z.coerce.date({ required_error: "Vui lòng chọn ngày kết thúc" }),
    durationUnit: z
      .nativeEnum(AbsenceDuration)
      .optional()
      .default(AbsenceDuration.FULL_DAY),
    reasonType: z
      .nativeEnum(AbsenceReasonType)
      .optional()
      .default(AbsenceReasonType.PERSONAL),
    reason: z
      .string({ required_error: "Lý do xin nghỉ là bắt buộc" })
      .trim()
      .min(5, "Lý do xin nghỉ phải từ 5 ký tự trở lên")
      .max(3000, "Lý do không được vượt quá 3000 ký tự"),
    evidenceUrl: z
      .string()
      .trim()
      .url("Đường dẫn minh chứng không hợp lệ")
      .optional()
      .or(z.literal(""))
      .nullable(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      // Nếu lý do là Lịch thi (EXAM), yêu cầu đính kèm file minh chứng
      if (data.reasonType === AbsenceReasonType.EXAM) {
        return !!data.evidenceUrl && data.evidenceUrl.trim().length > 0;
      }
      return true;
    },
    {
      message: "Lý do nghỉ thi bắt buộc phải đính kèm minh chứng lịch thi (ảnh hoặc PDF)",
      path: ["evidenceUrl"],
    },
  );

export const reviewGeneralAbsenceSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    errorMap: () => ({ message: "Trạng thái phê duyệt phải là APPROVED hoặc REJECTED" }),
  }),
  reviewNote: z.string().trim().max(2000, "Ghi chú không quá 2000 ký tự").optional(),
  autoExtendConflictTasks: z.boolean().optional().default(false),
  extendDays: z.coerce.number().int().min(1, "Số ngày gia hạn tối thiểu 1 ngày").max(30, "Số ngày gia hạn tối đa 30 ngày").optional(),
});

export const getAbsenceUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "Tên file là bắt buộc"),
  mimeType: z.string().trim().refine(
    (val) =>
      val.startsWith("image/") ||
      val === "application/pdf" ||
      val === "application/x-pdf",
    {
      message: "Chỉ chấp nhận file ảnh (PNG, JPG, WEBP) hoặc file PDF minh chứng",
    },
  ),
});
