import { Router } from "express";
import { DepartmentController } from "./department.controller";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  findAllDepartmentSchema,
  departmentIdParamSchema,
  createPositionSchema,
  updatePositionSchema,
  positionIdParamSchema,
} from "./department.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new DepartmentController();

// ── Department List & Detail (Public with optional auth context for Leader filtering) ──
router.get(
  "/",
  optionalAuthMiddleware,
  validate(findAllDepartmentSchema, "query"),
  controller.findAll,
);

// ── Positions Sub-routes (Placed before /:id to avoid URL collision) ──
router.get(
  "/:id/positions",
  validate(departmentIdParamSchema, "params"),
  controller.findPositionsByDepartment,
);

router.post(
  "/positions",
  authMiddleware,
  requirePermission(PERMISSIONS.POSITION_CREATE),
  validate(createPositionSchema),
  controller.createPosition,
);

router.post(
  "/:id/positions",
  authMiddleware,
  requirePermission(PERMISSIONS.POSITION_CREATE),
  validate(departmentIdParamSchema, "params"),
  validate(createPositionSchema),
  controller.createPosition,
);

router.put(
  "/positions/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.POSITION_UPDATE),
  validate(positionIdParamSchema, "params"),
  validate(updatePositionSchema),
  controller.updatePosition,
);

router.delete(
  "/positions/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.POSITION_DELETE),
  validate(positionIdParamSchema, "params"),
  controller.deletePosition,
);

// ── Department Resource Routes ──
router.get(
  "/:id",
  validate(departmentIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.DEPARTMENT_CREATE),
  validate(createDepartmentSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.DEPARTMENT_UPDATE),
  validate(departmentIdParamSchema, "params"),
  validate(updateDepartmentSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.DEPARTMENT_DELETE),
  validate(departmentIdParamSchema, "params"),
  controller.delete,
);

export default router;
