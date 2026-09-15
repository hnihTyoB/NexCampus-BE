import { Router } from "express";
import { z } from "zod";
import { DailyReportController } from "./daily-report.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  calendarDailyReportSchema,
  createDailyReportSchema,
  feedbackDailyReportSchema,
  queryDailyReportSchema,
  updateDailyReportSchema,
  uploadReportUrlSchema,
} from "./daily-report.validation";

const router = Router();
const controller = new DailyReportController();

const idParamSchema = z.object({
  id: z.string().uuid("ID báo cáo không hợp lệ"),
});

const attachmentParamSchema = z.object({
  attachmentId: z.string().uuid("ID tệp đính kèm không hợp lệ"),
});

// 1. Upload Presigned URL for Cloudflare R2
router.post(
  "/upload-url",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_CREATE),
  validate(uploadReportUrlSchema),
  controller.getUploadUrl,
);

// 2. Calendar View & Stats
router.get(
  "/calendar",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_READ),
  validate(calendarDailyReportSchema, "query"),
  controller.getCalendar,
);

// 3. List Daily Reports
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_READ),
  validate(queryDailyReportSchema, "query"),
  controller.findAll,
);

// 4. Create / Submit Daily Report
router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_CREATE),
  validate(createDailyReportSchema),
  controller.submitReport,
);

// 5. Delete Attachment
router.delete(
  "/attachments/:attachmentId",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_DELETE),
  validate(attachmentParamSchema, "params"),
  controller.deleteAttachment,
);

// 6. Detail Daily Report
router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_READ),
  validate(idParamSchema, "params"),
  controller.findById,
);

// 7. Update Daily Report
router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_UPDATE),
  validate(idParamSchema, "params"),
  validate(updateDailyReportSchema),
  controller.update,
);

// 8. Delete Daily Report
router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_DELETE),
  validate(idParamSchema, "params"),
  controller.delete,
);

// 9. Feedback on Daily Report (Leader / Admin)
router.post(
  "/:id/feedback",
  authMiddleware,
  requirePermission(PERMISSIONS.DAILY_REPORT_FEEDBACK),
  validate(idParamSchema, "params"),
  validate(feedbackDailyReportSchema),
  controller.addFeedback,
);

export default router;
