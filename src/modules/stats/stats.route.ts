import { Router } from "express";
import { StatsController } from "./stats.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new StatsController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.getAdminStats,
);

router.get(
  "/my",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.getLeaderStats,
);

router.get(
  "/me",
  authMiddleware,
  requireRole(ROLES.INTERN),
  controller.getInternStats,
);

export default router;
