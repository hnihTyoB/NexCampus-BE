import { Router } from "express";
import { z } from "zod";
import { WeeklyEvaluationController } from "./weekly-evaluation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  aiSuggestSchema,
  createWeeklyEvaluationSchema,
  queryWeeklyEvaluationSchema,
  updateWeeklyEvaluationSchema,
} from "./weekly-evaluation.validation";

const router = Router();
const controller = new WeeklyEvaluationController();

const idParamSchema = z.object({
  id: z.string().uuid("ID đánh giá không hợp lệ"),
});

const internIdParamSchema = z.object({
  internId: z.string().uuid("Intern ID không hợp lệ"),
});

// 1. AI Suggestion for Weekly Evaluation
router.post(
  "/ai-suggest",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_CREATE),
  validate(aiSuggestSchema),
  controller.getAiSuggestion,
);

// 2. Intern Progress Summary & 6-Week Chart Data
router.get(
  "/intern/:internId/summary",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_READ),
  validate(internIdParamSchema, "params"),
  controller.getSummary,
);

// 3. List Weekly Evaluations
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_READ),
  validate(queryWeeklyEvaluationSchema, "query"),
  controller.findAll,
);

// 4. Create Weekly Evaluation (Leader / Admin)
router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_CREATE),
  validate(createWeeklyEvaluationSchema),
  controller.create,
);

// 5. Detail Weekly Evaluation
router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_READ),
  validate(idParamSchema, "params"),
  controller.findById,
);

// 6. Update Weekly Evaluation (Leader / Admin)
router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_UPDATE),
  validate(idParamSchema, "params"),
  validate(updateWeeklyEvaluationSchema),
  controller.update,
);

// 7. Delete Weekly Evaluation
router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_DELETE),
  validate(idParamSchema, "params"),
  controller.delete,
);

// 8. Confirm View (Intern reads and confirms evaluation)
router.post(
  "/:id/confirm-view",
  authMiddleware,
  requirePermission(PERMISSIONS.WEEKLY_EVALUATION_CONFIRM),
  validate(idParamSchema, "params"),
  controller.confirmView,
);

export default router;
