import { Router } from "express";
import { DailyReportController } from "./daily-report.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllDailyReportSchema,
  createDailyReportSchema,
  updateDailyReportSchema,
} from "./daily-report.validation";
import { ROLES } from "../../common/constants/role.constant";
import reportAttachmentRoute from "../report-attachments/report-attachment.route";
import { uploadSingle } from "../../middlewares/upload.middleware";

const router = Router();
const controller = new DailyReportController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(findAllDailyReportSchema, "query"),
  controller.findAll,
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findById,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.INTERN),
  validate(createDailyReportSchema),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.INTERN),
  validate(updateDailyReportSchema),
  controller.update,
);
router.post(
  "/:id/video",
  authMiddleware,
  requireRole(ROLES.INTERN),
  uploadSingle("video", "reportVideo"),
  controller.uploadVideo,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.delete,
);

router.use("/:reportId/attachments", reportAttachmentRoute);

export default router;
