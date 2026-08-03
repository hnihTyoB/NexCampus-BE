import { Router } from "express";
import { LeaderController } from "./leader.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllLeaderSchema,
  createLeaderSchema,
  updateLeaderSchema,
  updateMeLeaderSchema,
} from "./leader.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new LeaderController();

// Leader self-service routes (must come before /:id)
router.get(
  "/me",
  authMiddleware,
  requireRole(ROLES.LEADER),
  controller.getMe,
);
router.put(
  "/me",
  authMiddleware,
  requireRole(ROLES.LEADER),
  validate(updateMeLeaderSchema),
  controller.updateMe,
);

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(findAllLeaderSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createLeaderSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateLeaderSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete,
);

export default router;
