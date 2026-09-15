import { Router } from "express";
import { MeetingController } from "./meeting.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  meetingIdParamSchema,
  absenceIdParamSchema,
  findAllMeetingSchema,
  createMeetingSchema,
  updateMeetingSchema,
  inviteParticipantsSchema,
  rsvpSchema,
  submitAbsenceSchema,
  reviewAbsenceSchema,
  getBusyUsersSchema,
} from "./meeting.validation";

const router = Router();
const controller = new MeetingController();

// ── Specific / Query Routes (placed before :id to prevent param collision) ──

router.get(
  "/busy-users",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_READ),
  validate(getBusyUsersSchema, "query"),
  controller.getBusyUsers,
);

router.get(
  "/absences/my",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_READ),
  controller.getMyAbsences,
);

router.get(
  "/absences/pending",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_ABSENCE_REVIEW),
  controller.getPendingAbsences,
);

router.put(
  "/absences/:absenceId/review",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_ABSENCE_REVIEW),
  validate(absenceIdParamSchema, "params"),
  validate(reviewAbsenceSchema),
  controller.reviewAbsence,
);

// ── Collection Routes ───────────────────────────────────────────────────────

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_READ),
  validate(findAllMeetingSchema, "query"),
  controller.findAll,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_CREATE),
  validate(createMeetingSchema),
  controller.create,
);

// ── Item Routes ─────────────────────────────────────────────────────────────

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_READ),
  validate(meetingIdParamSchema, "params"),
  controller.findById,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_UPDATE),
  validate(meetingIdParamSchema, "params"),
  validate(updateMeetingSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_DELETE),
  validate(meetingIdParamSchema, "params"),
  controller.delete,
);

// ── Participants & Attendance ───────────────────────────────────────────────

router.post(
  "/:id/participants",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_UPDATE),
  validate(meetingIdParamSchema, "params"),
  validate(inviteParticipantsSchema),
  controller.inviteParticipants,
);

router.post(
  "/:id/rsvp",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_ATTEND),
  validate(meetingIdParamSchema, "params"),
  validate(rsvpSchema),
  controller.rsvp,
);

router.post(
  "/:id/join",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_ATTEND),
  validate(meetingIdParamSchema, "params"),
  controller.join,
);

// ── Meeting Absences ────────────────────────────────────────────────────────

router.post(
  "/:id/absences",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_ABSENCE_SUBMIT),
  validate(meetingIdParamSchema, "params"),
  validate(submitAbsenceSchema),
  controller.submitAbsence,
);

router.get(
  "/:id/absences",
  authMiddleware,
  requirePermission(PERMISSIONS.MEETING_READ),
  validate(meetingIdParamSchema, "params"),
  controller.findAbsencesByMeeting,
);

export default router;
