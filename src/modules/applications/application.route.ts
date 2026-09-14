import { Router } from "express";
import { ApplicationController } from "./application.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  createInviteSchema,
  getApplicationInvitesSchema,
  verifyInviteParamSchema,
  verifyInviteQuerySchema,
  inviteIdParamSchema,
  createApplicationSchema,
  findAllApplicationSchema,
  applicationIdParamSchema,
  assignApplicationSchema,
  approveApplicationSchema,
  rejectApplicationSchema,
  reviewApplicationSchema,
  getAttachmentUploadUrlSchema,
} from "./application.validation";

const router = Router();
const controller = new ApplicationController();

// ─── Public Endpoints ───────────────────────────────────────────────────────

router.get(
  "/invites/verify/:token",
  validate(verifyInviteParamSchema, "params"),
  controller.verifyInvite,
);

router.get(
  "/invites/verify",
  validate(verifyInviteQuerySchema, "query"),
  controller.verifyInvite,
);

router.get(
  "/attachments/upload-url",
  validate(getAttachmentUploadUrlSchema, "query"),
  controller.getAttachmentUploadUrl,
);

router.post(
  "/submit",
  validate(createApplicationSchema),
  controller.submitApplication,
);

router.post(
  "/",
  validate(createApplicationSchema),
  controller.submitApplication,
);

// ─── Protected Application Invites ──────────────────────────────────────────

router.post(
  "/invites",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_INVITE_CREATE),
  validate(createInviteSchema),
  controller.createInvite,
);

router.get(
  "/invites",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_INVITE_READ),
  validate(getApplicationInvitesSchema, "query"),
  controller.findAllInvites,
);

router.get(
  "/invites/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_INVITE_READ),
  validate(inviteIdParamSchema, "params"),
  controller.findInviteById,
);

router.patch(
  "/invites/:id/revoke",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_INVITE_REVOKE),
  validate(inviteIdParamSchema, "params"),
  controller.revokeInvite,
);

// ─── Protected Applications Management ──────────────────────────────────────

router.get(
  "/stats",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_READ),
  controller.getStats,
);

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_READ),
  validate(findAllApplicationSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_READ),
  validate(applicationIdParamSchema, "params"),
  controller.findById,
);

router.patch(
  "/:id/assign",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_ASSIGN),
  validate(applicationIdParamSchema, "params"),
  validate(assignApplicationSchema),
  controller.assign,
);

router.patch(
  "/:id/assignment",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_ASSIGN),
  validate(applicationIdParamSchema, "params"),
  validate(assignApplicationSchema),
  controller.assign,
);

router.post(
  "/:id/approve",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_REVIEW),
  validate(applicationIdParamSchema, "params"),
  validate(approveApplicationSchema),
  controller.approve,
);

router.post(
  "/:id/reject",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_REVIEW),
  validate(applicationIdParamSchema, "params"),
  validate(rejectApplicationSchema),
  controller.reject,
);

router.patch(
  "/:id/review",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_REVIEW),
  validate(applicationIdParamSchema, "params"),
  validate(reviewApplicationSchema),
  controller.review,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.APPLICATION_DELETE),
  validate(applicationIdParamSchema, "params"),
  controller.delete,
);

export default router;
