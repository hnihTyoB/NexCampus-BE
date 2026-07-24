import { Router } from "express";
import { ApplicationController } from "./application.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createApplicationSchema,
  findAllApplicationSchema,
  reviewApplicationSchema,
  createInviteSchema,
  getApplicationInvitesSchema,
} from "./application.validation";
import { ROLES } from "../../common/constants/role.constant";
import { uploadMultiple } from "../../middlewares/upload.middleware";

const router = Router();
const controller = new ApplicationController();

router.post(
  "/invites",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createInviteSchema),
  controller.createInvite,
);
router.get(
  "/invites",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(getApplicationInvitesSchema, "query"),
  controller.getApplicationInvites,
);
router.get("/invites/verify", controller.verifyInvite);
router.get(
  "/invites/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.getInviteById,
);
router.patch(
  "/invites/:id/revoke",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.revokeInvite,
);

router.post("/", uploadMultiple("files", 5, "application"), validate(createApplicationSchema), controller.create);
router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(findAllApplicationSchema, "query"),
  controller.findAll,
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.findById,
);
router.patch(
  "/:id/review",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(reviewApplicationSchema),
  controller.review,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete,
);

export default router;
