import { z } from "zod";

const attachmentInputSchema = z.object({
  fileName: z.string().trim().min(1, "Tên tệp không được để trống"),
  fileUrl: z.string().trim().min(1, "URL tệp không được để trống"),
  filePath: z.string().trim().min(1, "Đường dẫn tệp không được để trống"),
  mimeType: z.string().trim().min(1, "Loại tệp không được để trống"),
  fileSize: z.number().int().positive("Dung lượng tệp phải lớn hơn 0"),
});

export const createDailyReportSchema = z.object({
  internId: z.string().uuid("Intern ID không hợp lệ").optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày báo cáo phải có định dạng YYYY-MM-DD")
    .optional(),
  content: z.string().trim().min(1, "Nội dung công việc hoàn thành không được để trống"),
  blockers: z.string().trim().optional().nullable(),
  nextPlan: z.string().trim().optional().nullable(),
  hoursWorked: z.coerce.number().min(0, "Số giờ làm việc không được âm").max(24, "Số giờ làm việc tối đa 24h").optional(),
  prLink: z.string().trim().url("Link PR không hợp lệ").optional().or(z.literal("")).nullable(),
  videoDemo: z.string().trim().optional().nullable(),
  attachments: z.array(attachmentInputSchema).max(5, "Tối đa 5 tệp đính kèm").optional(),
});

export const updateDailyReportSchema = z.object({
  content: z.string().trim().min(1, "Nội dung công việc không được để trống").optional(),
  blockers: z.string().trim().optional().nullable(),
  nextPlan: z.string().trim().optional().nullable(),
  hoursWorked: z.coerce.number().min(0).max(24).optional(),
  prLink: z.string().trim().url("Link PR không hợp lệ").optional().or(z.literal("")).nullable(),
  videoDemo: z.string().trim().optional().nullable(),
  attachments: z.array(attachmentInputSchema).max(5, "Tối đa 5 tệp đính kèm").optional(),
});

export const feedbackDailyReportSchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, "Nội dung nhận xét/phản hồi không được để trống")
    .max(2000, "Nội dung nhận xét tối đa 2000 ký tự"),
});

export const queryDailyReportSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày lọc: YYYY-MM-DD")
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày bắt đầu: YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày kết thúc: YYYY-MM-DD")
    .optional(),
  internId: z.string().uuid("Intern ID không hợp lệ").optional(),
  departmentId: z.string().uuid("Department ID không hợp lệ").optional(),
  sortBy: z.enum(["date", "createdAt", "hoursWorked"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const calendarDailyReportSchema = z.object({
  month: z.coerce.number().int().min(1, "Tháng từ 1 đến 12").max(12, "Tháng từ 1 đến 12"),
  year: z.coerce.number().int().min(2000, "Năm từ 2000 trở lên").max(2100),
  internId: z.string().uuid("Intern ID không hợp lệ").optional(),
});

export const uploadReportUrlSchema = z.object({
  fileName: z.string().trim().min(1, "Tên file không được để trống"),
  mimeType: z.string().trim().min(1, "Mime type không được để trống"),
});

export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>;
export type UpdateDailyReportInput = z.infer<typeof updateDailyReportSchema>;
export type FeedbackDailyReportInput = z.infer<typeof feedbackDailyReportSchema>;
export type QueryDailyReportInput = z.infer<typeof queryDailyReportSchema>;
export type CalendarDailyReportInput = z.infer<typeof calendarDailyReportSchema>;
export type UploadReportUrlInput = z.infer<typeof uploadReportUrlSchema>;
