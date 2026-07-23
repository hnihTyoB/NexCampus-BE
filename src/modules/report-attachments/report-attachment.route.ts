import { Router } from "express";
import { ReportAttachmentController } from "./report-attachment.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { uploadSingle } from "../../middlewares/upload.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router({ mergeParams: true });
const controller = new ReportAttachmentController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findByReport,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  uploadSingle("file", "report"),
  controller.upload,
);
router.delete(
  "/:attachmentId",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.delete,
);

export default router;
