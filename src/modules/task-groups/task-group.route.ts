import { Router } from "express";
import { TaskGroupController } from "./task-group.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createTaskGroupSchema, updateTaskGroupSchema } from "./task-group.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new TaskGroupController();

// Public read
router.get("/", controller.findAll);
router.get("/:id", controller.findById);

// Admin / Leader write
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(createTaskGroupSchema),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(updateTaskGroupSchema),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.delete,
);

export default router;
