import { Router } from "express";
import { DepartmentController } from "./department.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createPositionSchema,
  updatePositionSchema,
  findAllDepartmentSchema,
} from "./department.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new DepartmentController();

// Public (with optional auth mapping for Leader filtering)
router.get("/", optionalAuthMiddleware, validate(findAllDepartmentSchema, "query"), controller.findAll);

// Position routes (must come before /:id to avoid route conflicts)
router.get("/:id/positions", controller.findPositionsByDepartment);
router.post(
  "/positions",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(createPositionSchema),
  controller.createPosition,
);
router.put(
  "/positions/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(updatePositionSchema),
  controller.updatePosition,
);
router.delete(
  "/positions/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.deletePosition,
);

router.get("/:id", controller.findById);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateDepartmentSchema),
  controller.update,
);
// DELETE department: ADMIN only — Leader không được xóa department
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete,
);

// POST department: ADMIN only — Leader không được tạo department mới
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createDepartmentSchema),
  controller.create,
);

export default router;
