import { Router } from "express";
import { TaskSubmissionController } from "./task-submission.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  submissionIdParamSchema,
  attachmentIdParamSchema,
  findAllSubmissionSchema,
  createSubmissionSchema,
  reviewSubmissionSchema,
  getSubmissionUploadUrlSchema,
  addAttachmentSchema,
} from "./task-submission.validation";

const router = Router();
const controller = new TaskSubmissionController();

// 1. Presigned Upload URL for Cloudflare R2
router.get(
  "/upload-url",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_CREATE),
  validate(getSubmissionUploadUrlSchema, "query"),
  controller.getUploadUrl,
);

// 2. List & Detail
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_READ),
  validate(findAllSubmissionSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_READ),
  validate(submissionIdParamSchema, "params"),
  controller.findById,
);

// 3. Create Submission (Intern)
router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_CREATE),
  validate(createSubmissionSchema),
  controller.create,
);

// 4. Review Submission (Leader/Admin)
router.post(
  "/:id/review",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_REVIEW),
  validate(submissionIdParamSchema, "params"),
  validate(reviewSubmissionSchema),
  controller.review,
);

// 5. Attachments sub-routes
router.post(
  "/:id/attachments",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_CREATE),
  validate(submissionIdParamSchema, "params"),
  validate(addAttachmentSchema),
  controller.addAttachment,
);

router.delete(
  "/:id/attachments/:attachmentId",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_SUBMISSION_DELETE),
  validate(attachmentIdParamSchema, "params"),
  controller.deleteAttachment,
);

export default router;
