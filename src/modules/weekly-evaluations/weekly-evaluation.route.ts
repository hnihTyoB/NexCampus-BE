import { Router } from "express";
import { WeeklyEvaluationController } from "./weekly-evaluation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllWeeklyEvaluationSchema,
  createWeeklyEvaluationSchema,
  updateWeeklyEvaluationSchema,
  aiSuggestionSchema,
} from "./weekly-evaluation.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new WeeklyEvaluationController();

// AI suggestion route PHẢI đặt trước /:id để tránh conflict
router.post(
  "/ai-suggestion",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(aiSuggestionSchema),
  controller.getAiSuggestion,
);

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(findAllWeeklyEvaluationSchema, "query"),
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
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(createWeeklyEvaluationSchema),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(updateWeeklyEvaluationSchema),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.delete,
);

// Intern xác nhận đã xem đánh giá — phải đặt SAU /:id (tránh conflict với POST /ai-suggestion)
router.patch(
  "/:id/mark-reviewed",
  authMiddleware,
  requireRole(ROLES.INTERN),
  controller.markReviewed,
);

export default router;
