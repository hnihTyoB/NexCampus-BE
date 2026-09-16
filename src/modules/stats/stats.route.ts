import { Router } from "express";
import { statsController, StatsController } from "./stats.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { internStatsQuerySchema } from "./stats.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller: StatsController = statsController;

// ── Admin Dashboard Statistics ──
router.get(
  "/admin",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.getAdminStats
);

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.getAdminStats
);

// ── Leader Team Dashboard Statistics ──
router.get(
  "/leader",
  authMiddleware,
  requireRole(ROLES.LEADER, ROLES.ADMIN),
  controller.getLeaderStats
);

router.get(
  "/my",
  authMiddleware,
  requireRole(ROLES.LEADER, ROLES.ADMIN),
  controller.getLeaderStats
);

// ── Intern Personal Dashboard Statistics ──
router.get(
  "/intern",
  authMiddleware,
  validate(internStatsQuerySchema, "query"),
  controller.getInternStats
);

router.get(
  "/me",
  authMiddleware,
  validate(internStatsQuerySchema, "query"),
  controller.getInternStats
);

export default router;
