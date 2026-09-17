import { Router } from "express";
import { statsController, StatsController } from "./stats.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  requirePermission,
  requireAnyPermission,
} from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { internStatsQuerySchema } from "./stats.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller: StatsController = statsController;

// ── Admin Dashboard Statistics ──
router.get(
  "/admin",
  authMiddleware,
  requirePermission(PERMISSIONS.STATS_ADMIN_READ),
  controller.getAdminStats
);

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.STATS_ADMIN_READ),
  controller.getAdminStats
);

// ── Leader Team Dashboard Statistics ──
router.get(
  "/leader",
  authMiddleware,
  requireAnyPermission(
    PERMISSIONS.STATS_LEADER_READ,
    PERMISSIONS.STATS_ADMIN_READ
  ),
  controller.getLeaderStats
);

router.get(
  "/my",
  authMiddleware,
  requireAnyPermission(
    PERMISSIONS.STATS_LEADER_READ,
    PERMISSIONS.STATS_ADMIN_READ
  ),
  controller.getLeaderStats
);

// ── Intern Personal Dashboard Statistics ──
router.get(
  "/intern",
  authMiddleware,
  requireAnyPermission(
    PERMISSIONS.STATS_INTERN_READ,
    PERMISSIONS.STATS_LEADER_READ,
    PERMISSIONS.STATS_ADMIN_READ
  ),
  validate(internStatsQuerySchema, "query"),
  controller.getInternStats
);

router.get(
  "/me",
  authMiddleware,
  requireAnyPermission(
    PERMISSIONS.STATS_INTERN_READ,
    PERMISSIONS.STATS_LEADER_READ,
    PERMISSIONS.STATS_ADMIN_READ
  ),
  validate(internStatsQuerySchema, "query"),
  controller.getInternStats
);

export default router;
