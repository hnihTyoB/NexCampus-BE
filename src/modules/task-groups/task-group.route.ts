import { Router } from "express";
import { TaskGroupController } from "./task-group.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  createTaskGroupSchema,
  updateTaskGroupSchema,
  queryTaskGroupSchema,
  taskGroupIdParamSchema,
  confirmGroupAiAllocationSchema,
} from "./task-group.validation";

const router = Router();
const controller = new TaskGroupController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_READ),
  validate(queryTaskGroupSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id/progress",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_READ),
  validate(taskGroupIdParamSchema, "params"),
  controller.getProgress,
);

router.get(
  "/:id/tasks",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_READ),
  validate(taskGroupIdParamSchema, "params"),
  controller.findTasks,
);

router.post(
  "/:id/ai-recommendation",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_CREATE),
  validate(taskGroupIdParamSchema, "params"),
  controller.getAiRecommendation,
);

router.post(
  "/:id/ai-allocation/confirm",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_ASSIGNMENT_CREATE),
  validate(taskGroupIdParamSchema, "params"),
  validate(confirmGroupAiAllocationSchema),
  controller.confirmAiAllocation,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_READ),
  validate(taskGroupIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_CREATE),
  validate(createTaskGroupSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_UPDATE),
  validate(taskGroupIdParamSchema, "params"),
  validate(updateTaskGroupSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.TASK_GROUP_DELETE),
  validate(taskGroupIdParamSchema, "params"),
  controller.delete,
);

export default router;
