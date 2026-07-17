import { Router } from "express";
import { InternController } from "./intern.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllInternSchema,
  createInternSchema,
  updateInternSchema,
  updateMeInternSchema,
  assignLeaderSchema,
} from "./intern.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new InternController();

// Intern self-service routes (must come before /:id)
router.get(
  "/me",
  authMiddleware,
  requireRole(ROLES.INTERN),
  controller.getMe,
);
router.put(
  "/me",
  authMiddleware,
  requireRole(ROLES.INTERN),
  validate(updateMeInternSchema),
  controller.updateMe,
);

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(findAllInternSchema, "query"),
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
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(createInternSchema),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(updateInternSchema),
  controller.update,
);
router.patch(
  "/:id/assign-leader",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(assignLeaderSchema),
  controller.assignLeader,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete,
);

export default router;
