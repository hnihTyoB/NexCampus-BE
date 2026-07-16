import { Router } from "express";
import { DepartmentController } from "./department.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createPositionSchema,
  updatePositionSchema,
} from "./department.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new DepartmentController();

// Public
router.get("/", controller.findAll);

// Position routes (must come before /:id to avoid route conflicts)
router.get("/:id/positions", controller.findPositionsByDepartment);
router.post(
  "/positions",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createPositionSchema),
  controller.createPosition,
);
router.put(
  "/positions/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updatePositionSchema),
  controller.updatePosition,
);
router.delete(
  "/positions/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.deletePosition,
);

// Department detail (parameterized — must come after specific routes)
router.get("/:id", controller.findById);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateDepartmentSchema),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete,
);

// Department create
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createDepartmentSchema),
  controller.create,
);

export default router;
