import { Router } from "express";
import { AbsenceController } from "./absence.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  absenceIdParamSchema,
  findAllAbsenceSchema,
  createAbsenceSchema,
  reviewGeneralAbsenceSchema,
} from "./absence.validation";

const router = Router();
const controller = new AbsenceController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_READ),
  validate(findAllAbsenceSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_READ),
  validate(absenceIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_CREATE),
  validate(createAbsenceSchema),
  controller.create,
);

router.post(
  "/:id/review",
  authMiddleware,
  requirePermission(PERMISSIONS.ABSENCE_REVIEW),
  validate(absenceIdParamSchema, "params"),
  validate(reviewGeneralAbsenceSchema),
  controller.review,
);

export default router;
