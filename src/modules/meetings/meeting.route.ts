import { Router } from "express";
import { MeetingController } from "./meeting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllMeetingSchema,
  createMeetingSchema,
  updateMeetingSchema,
  inviteParticipantsSchema,
  rsvpSchema,
  submitAbsenceSchema,
  reviewAbsenceSchema,
} from "./meeting.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new MeetingController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(findAllMeetingSchema, "query"),
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
  validate(createMeetingSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(updateMeetingSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.delete,
);

// ── Participants ──────────────────────────────────────────────────────────

router.post(
  "/:id/participants",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(inviteParticipantsSchema),
  controller.inviteParticipants,
);

router.post(
  "/:id/rsvp",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(rsvpSchema),
  controller.rsvp,
);

router.post(
  "/:id/join",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.join,
);

// ── Absence Requests ──────────────────────────────────────────────────────

router.post(
  "/:id/absences",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  validate(submitAbsenceSchema),
  controller.submitAbsence,
);

router.get(
  "/:id/absences",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findAbsencesByMeeting,
);

router.put(
  "/absences/:absenceId/review",
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  validate(reviewAbsenceSchema),
  controller.reviewAbsence,
);

export default router;
