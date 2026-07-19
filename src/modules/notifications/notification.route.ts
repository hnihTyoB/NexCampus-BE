import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllNotificationSchema,
  createNotificationSchema,
  sendCustomNotificationSchema,
} from "./notification.validation";
import { ROLES } from "../../common/constants/role.constant";

import { rateLimitMiddleware } from "../../middlewares/rate-limit.middleware";

const router = Router();
const controller = new NotificationController();

router.post(
  "/send-custom",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  rateLimitMiddleware,
  validate(sendCustomNotificationSchema),
  controller.sendCustom,
);

router.post(
  "/remind/tasks",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.triggerTaskReminders,
);
router.post(
  "/remind/evaluations",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.triggerEvaluationReminders,
);

router.get(
  "/ticket",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.getTicket,
);

router.get(
  "/stream",
  controller.stream,
);

router.patch(
  "/read-all",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.markAllAsRead,
);

router.get(
  "/unread-count",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.countUnread,
);

router.delete(
  "/clear-read",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.clearRead,
);

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(findAllNotificationSchema, "query"),
  controller.findAll,
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findById,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(createNotificationSchema),
  controller.create,
);
router.patch(
  "/:id/read",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.markAsRead,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.delete,
);

export default router;
