import { Router } from "express";
import { LeaderController } from "./leader.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllLeaderSchema,
  createLeaderSchema,
  updateLeaderSchema,
  updateMeLeaderSchema,
  leaderIdParamSchema,
} from "./leader.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new LeaderController();

// ── Leader Self-Service Routes (Placed before /:id) ──
router.get("/me", authMiddleware, controller.getMe);
router.put(
  "/me",
  authMiddleware,
  validate(updateMeLeaderSchema),
  controller.updateMe,
);

// ── Leader Management Routes ──
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.LEADER_READ),
  validate(findAllLeaderSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.LEADER_READ),
  validate(leaderIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.LEADER_CREATE),
  validate(createLeaderSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.LEADER_UPDATE),
  validate(leaderIdParamSchema, "params"),
  validate(updateLeaderSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.LEADER_DELETE),
  validate(leaderIdParamSchema, "params"),
  controller.delete,
);

export default router;
