import { Router } from "express";
import { RegulationController } from "./regulation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../common/constants/role.constant";
import {
  createRegulationSchema,
  updateRegulationSchema,
} from "./regulation.validation";

const router = Router();
const controller = new RegulationController();

// Public route: intern reads the active regulation before submitting application
router.get("/active", controller.findActive);

// Protected routes (Admin & Leader)
router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.findAll
);

router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.findById
);

// Admin-only routes
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createRegulationSchema),
  controller.create
);

router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateRegulationSchema),
  controller.update
);

router.patch(
  "/:id/activate",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.activate
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete
);

export default router;
