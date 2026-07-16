import { Router } from "express";
import { PdfExportController } from "./pdf-export.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new PdfExportController();

// Leader hoặc Admin có quyền xuất báo cáo đánh giá tuần thành PDF
router.post(
  "/weekly-evaluations/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.exportWeeklyEvaluation,
);

export default router;
