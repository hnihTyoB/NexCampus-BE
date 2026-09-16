import { Router } from "express";
import { pdfExportController, PdfExportController } from "./pdf-export.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  exportWeeklyEvaluationParamSchema,
  exportInternshipSummaryParamSchema,
} from "./pdf-export.validation";

const router = Router();
const controller: PdfExportController = pdfExportController;

// ── Export Weekly Evaluation PDF ──
router.post(
  "/weekly-evaluation/:id",
  authMiddleware,
  validate(exportWeeklyEvaluationParamSchema, "params"),
  controller.exportWeeklyEvaluation
);

// ── Export Internship Summary / Certificate PDF ──
router.post(
  "/internship-summary/:internId",
  authMiddleware,
  validate(exportInternshipSummaryParamSchema, "params"),
  controller.exportInternshipSummary
);

export default router;
