import { Router } from "express";
import { TaskAttachmentController } from "./task-attachment.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { uploadMultiple } from "../../middlewares/upload.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router({ mergeParams: true });
const controller = new TaskAttachmentController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findByTask,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  uploadMultiple("file", 3, "taskAttachment"),
  controller.upload,
);
router.post(
  "/link",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.createLink,
);
router.delete(
  "/:attachmentId",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.delete,
);
router.get(
  "/upload-url",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.getPutUrl,
);
router.post(
  "/confirm",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.confirmUpload,
);

export default router;
