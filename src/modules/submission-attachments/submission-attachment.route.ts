import { Router } from "express";
import { SubmissionAttachmentController } from "./submission-attachment.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { uploadSingle } from "../../middlewares/upload.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router({ mergeParams: true });
const controller = new SubmissionAttachmentController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findBySubmission,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  uploadSingle("file", "submissionAttachment"),
  controller.upload,
);
router.delete(
  "/:attachmentId",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.delete,
);
// Presigned URL routes (browser uploads directly to R2)
router.get(
  "/upload-url",
  authMiddleware,
  requireRole(ROLES.INTERN),
  controller.getPutUrl,
);
router.post(
  "/confirm",
  authMiddleware,
  requireRole(ROLES.INTERN),
  controller.confirmUpload,
);

export default router;
