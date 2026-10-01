import { Router } from "express";
import { AbsenceController } from "./absence.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { validate } from "../../middlewares/validate.middleware";
import {
  absenceIdParamSchema,
  createAbsenceSchema,
  findAllAbsenceSchema,
  getAbsenceUploadUrlSchema,
  reviewGeneralAbsenceSchema,
} from "./absence.validation";

const router = Router();
const controller = new AbsenceController();

// 1. Presigned upload URL cho file minh chứng (ảnh / PDF lịch thi)
router.post(
  "/upload-url",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_CREATE),
  validate(getAbsenceUploadUrlSchema),
  controller.getUploadPresignedUrl,
);

// 2. Danh sách đơn xin nghỉ (Intern: đơn của mình; Leader: đơn của team; Admin: toàn bộ)
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_READ),
  validate(findAllAbsenceSchema, "query"),
  controller.findAll,
);

// 3. Chi tiết đơn xin nghỉ
router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_READ),
  validate(absenceIdParamSchema, "params"),
  controller.findById,
);

// 4. Lấy danh sách task bị xung đột deadline với đợt nghỉ
router.get(
  "/:id/conflicts",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_READ),
  validate(absenceIdParamSchema, "params"),
  controller.getTaskConflicts,
);

// 5. Tạo mới đơn xin nghỉ phép (Intern)
router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_CREATE),
  validate(createAbsenceSchema),
  controller.create,
);

// 6. Phê duyệt hoặc từ chối đơn xin nghỉ (Leader / Admin)
router.post(
  "/:id/review",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_REVIEW),
  validate(absenceIdParamSchema, "params"),
  validate(reviewGeneralAbsenceSchema),
  controller.review,
);

// 7. Hủy đơn xin nghỉ khi còn PENDING (Intern)
router.post(
  "/:id/cancel",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_CANCEL),
  validate(absenceIdParamSchema, "params"),
  controller.cancel,
);

export default router;
