import { Router } from "express";
import { AbsenceController } from "./absence.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
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
  validate(getAbsenceUploadUrlSchema),
  controller.getUploadPresignedUrl,
);

// 2. Danh sách đơn xin nghỉ (Intern: đơn của mình; Leader: đơn của team; Admin: toàn bộ)
router.get(
  "/",
  authMiddleware,
  validate(findAllAbsenceSchema, "query"),
  controller.findAll,
);

// 3. Chi tiết đơn xin nghỉ
router.get(
  "/:id",
  authMiddleware,
  validate(absenceIdParamSchema, "params"),
  controller.findById,
);

// 4. Lấy danh sách task bị xung đột deadline với đợt nghỉ
router.get(
  "/:id/conflicts",
  authMiddleware,
  validate(absenceIdParamSchema, "params"),
  controller.getTaskConflicts,
);

// 5. Tạo mới đơn xin nghỉ phép (Intern)
router.post(
  "/",
  authMiddleware,
  validate(createAbsenceSchema),
  controller.create,
);

// 6. Phê duyệt hoặc từ chối đơn xin nghỉ (Leader / Admin)
router.post(
  "/:id/review",
  authMiddleware,
  validate(absenceIdParamSchema, "params"),
  validate(reviewGeneralAbsenceSchema),
  controller.review,
);

// 7. Hủy đơn xin nghỉ khi còn PENDING (Intern)
router.post(
  "/:id/cancel",
  authMiddleware,
  validate(absenceIdParamSchema, "params"),
  controller.cancel,
);

export default router;
