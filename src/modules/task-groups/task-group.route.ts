import { Router } from "express";
import { TaskGroupController } from "./task-group.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  confirmGroupAllocationSchema,
  createTaskGroupSchema,
  updateTaskGroupSchema,
} from "./task-group.validation";
import { ROLES } from "../../common/constants/role.constant";
import { aiRequestGuardMiddleware } from "../../middlewares/ai-request-guard.middleware";

const router = Router();
const controller = new TaskGroupController();

// Public read (requires auth)
router.get("/", authMiddleware, controller.findAll);
router.get("/:id", authMiddleware, controller.findById);

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

// Group AI Allocation
router.post(
  "/:id/ai-recommendation",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  aiRequestGuardMiddleware,
  controller.getAiRecommendation,
);

router.post(
  "/:id/ai-allocation/confirm",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(confirmGroupAllocationSchema),
  controller.confirmAiAllocation,
);

export default router;
