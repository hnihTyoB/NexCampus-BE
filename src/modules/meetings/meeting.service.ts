import { MeetingRepository } from "./meeting.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  MeetingQueryDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  InviteParticipantsDto,
  RsvpDto,
  SubmitAbsenceDto,
  ReviewAbsenceDto,
} from "./meeting.dto";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

interface Actor {
  id: string;
  email: string;
  role: string;
}

export class MeetingService {
  private readonly repository = new MeetingRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: MeetingQueryDto, actor: Actor) {
    if (actor.role === "INTERN" && query.participantId && query.participantId !== actor.id) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }
    return this.repository.findAll(query, actor.id, actor.role);
  }

  async findById(id: string, actor: Actor) {
    const meeting = await this.repository.findById(id);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (actor.role === "INTERN") {
      const isParticipant = meeting.participants.some(
        (p) => p.userId === actor.id,
      );
      if (!isParticipant) {
        throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
      }
    }

    return meeting;
  }

  async create(data: CreateMeetingDto, createdBy: string) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (startTime >= endTime) {
      throw new AppError(
        "startTime must be before endTime",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (data.status !== "DRAFT" && startTime <= new Date()) {
      throw new AppError(
        "startTime must be in the future for scheduled meetings",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // Check host time conflicts
    const conflicts = await this.repository.findByTimeRange(
      data.hostId,
      startTime,
      endTime,
    );
    if (conflicts.length > 0) {
      throw new AppError(
        "Host has a conflicting meeting at this time",
        409,
        ERROR_CODE.MEETING_TIME_CONFLICT,
      );
    }

    // Repository handles participant roles: creator=ORGANIZER/HOST, host=HOST, others=PARTICIPANT
    const result = await this.repository.create(data, createdBy);

    await this.activityLogService.log(
      createdBy,
      ACTIVITY_ACTIONS.CREATE_MEETING,
      `Created meeting: ${result.title}`,
      result.id,
      "Meeting",
    );

    return result;
  }

  async update(id: string, data: UpdateMeetingDto, actor: Actor) {
    const meeting = await this.repository.findById(id);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
      throw new AppError(
        "Cannot update a completed or cancelled meeting",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    if (
      actor.role !== "ADMIN" &&
      actor.id !== meeting.createdBy &&
      actor.id !== meeting.hostId
    ) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    const newStart = data.startTime ? new Date(data.startTime) : meeting.startTime;
    const newEnd = data.endTime ? new Date(data.endTime) : meeting.endTime;
    const newHostId = data.hostId || meeting.hostId;

    if (data.startTime || data.endTime || data.hostId) {
      if (newStart >= newEnd) {
        throw new AppError(
          "startTime must be before endTime",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const conflicts = await this.repository.findByTimeRange(
        newHostId,
        newStart,
        newEnd,
        id,
      );
      if (conflicts.length > 0) {
        throw new AppError(
          "Host has a conflicting meeting at this time",
          409,
          ERROR_CODE.MEETING_TIME_CONFLICT,
        );
      }
    }

    const result = await this.repository.update(id, data);

    await this.activityLogService.log(
      actor.id,
      data.status === "CANCELLED"
        ? ACTIVITY_ACTIONS.CANCEL_MEETING
        : ACTIVITY_ACTIONS.UPDATE_MEETING,
      `Updated meeting: ${result.title}`,
      result.id,
      "Meeting",
    );

    return result;
  }

  async delete(id: string, actor: Actor) {
    const meeting = await this.repository.findById(id);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (actor.role !== "ADMIN" && actor.id !== meeting.createdBy) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    const result = await this.repository.softDelete(id);

    await this.activityLogService.log(
      actor.id,
      ACTIVITY_ACTIONS.DELETE_MEETING,
      `Deleted meeting: ${meeting.title}`,
      id,
      "Meeting",
    );

    return result;
  }

  // ── Participants ──────────────────────────────────────────────────────

  async inviteParticipants(
    meetingId: string,
    data: InviteParticipantsDto,
    actor: Actor,
  ) {
    const meeting = await this.repository.findById(meetingId);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
      throw new AppError(
        "Cannot invite to a completed or cancelled meeting",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    if (
      actor.role !== "ADMIN" &&
      actor.id !== meeting.createdBy &&
      actor.id !== meeting.hostId
    ) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    const existingIds = new Set([
      meeting.createdBy,
      meeting.hostId,
      ...meeting.participants.map((p) => p.userId),
    ]);

    const newIds = data.participantIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return { added: 0, skipped: data.participantIds.length };
    }

    const result = await this.repository.addParticipants(meetingId, newIds);

    await this.activityLogService.log(
      actor.id,
      ACTIVITY_ACTIONS.INVITE_MEETING_PARTICIPANT,
      `Invited ${newIds.length} participants to meeting: ${meeting.title}`,
      meetingId,
      "Meeting",
    );

    return { added: result.count, skipped: data.participantIds.length - newIds.length };
  }

  async rsvp(meetingId: string, actor: Actor, data: RsvpDto) {
    const meeting = await this.repository.findById(meetingId);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
      throw new AppError(
        "Cannot RSVP to a completed or cancelled meeting",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    const participant = await this.repository.findParticipant(meetingId, actor.id);
    if (!participant) {
      throw new AppError(
        "You are not invited to this meeting",
        403,
        ERROR_CODE.NOT_MEETING_PARTICIPANT,
      );
    }

    const result = await this.repository.updateParticipantRsvp(
      meetingId,
      actor.id,
      data.status,
    );

    await this.activityLogService.log(
      actor.id,
      ACTIVITY_ACTIONS.RSVP_MEETING,
      `${data.status === "ACCEPTED" ? "Accepted" : "Declined"} meeting: ${meeting.title}`,
      meetingId,
      "Meeting",
    );

    return result;
  }

  async joinMeeting(meetingId: string, actor: Actor) {
    const meeting = await this.repository.findById(meetingId);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
      throw new AppError(
        "Cannot join a completed or cancelled meeting",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    const existing = await this.repository.findParticipant(meetingId, actor.id);

    if (existing) {
      // Already joined
      if (existing.attendanceStatus === "ATTENDED") {
        return existing;
      }
      const result = await this.repository.updateParticipantJoin(meetingId, actor.id);

      await this.activityLogService.log(
        actor.id,
        ACTIVITY_ACTIONS.JOIN_MEETING,
        `Joined meeting: ${meeting.title}`,
        meetingId,
        "Meeting",
      );

      return result;
    }

    // Admins can join any meeting
    if (actor.role === "ADMIN") {
      await this.repository.addParticipants(meetingId, [actor.id]);
      const result = await this.repository.updateParticipantJoin(meetingId, actor.id);

      await this.activityLogService.log(
        actor.id,
        ACTIVITY_ACTIONS.JOIN_MEETING,
        `Admin joined meeting: ${meeting.title}`,
        meetingId,
        "Meeting",
      );

      return result;
    }

    // TEAM meetings: Leaders can join without explicit invitation
    if (meeting.visibility === "TEAM" && actor.role === "LEADER") {
      await this.repository.addParticipants(meetingId, [actor.id]);
      const result = await this.repository.updateParticipantJoin(meetingId, actor.id);

      await this.activityLogService.log(
        actor.id,
        ACTIVITY_ACTIONS.JOIN_MEETING,
        `Joined meeting: ${meeting.title}`,
        meetingId,
        "Meeting",
      );

      return result;
    }

    throw new AppError(
      "You are not invited to this meeting",
      403,
      ERROR_CODE.NOT_MEETING_PARTICIPANT,
    );
  }

  // ── Absence Requests ──────────────────────────────────────────────────

  async submitAbsence(
    meetingId: string,
    actor: Actor,
    data: SubmitAbsenceDto,
  ) {
    const meeting = await this.repository.findById(meetingId);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
      throw new AppError(
        "Cannot submit absence for a completed or cancelled meeting",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    const participant = await this.repository.findParticipant(meetingId, actor.id);
    if (!participant) {
      throw new AppError(
        "You are not invited to this meeting",
        403,
        ERROR_CODE.NOT_MEETING_PARTICIPANT,
      );
    }

    const existing = await this.repository.findAbsenceByMeetingAndParticipant(
      meetingId,
      participant.id,
    );
    if (existing) {
      throw new AppError(
        "You have already submitted an absence request for this meeting",
        409,
        ERROR_CODE.ABSENCE_ALREADY_SUBMITTED,
      );
    }

    const result = await this.repository.createAbsenceRequest(
      participant.id,
      meetingId,
      data.reason,
      data.attachmentUrl,
    );

    await this.activityLogService.log(
      actor.id,
      ACTIVITY_ACTIONS.SUBMIT_ABSENCE,
      `Submitted absence request for meeting: ${meeting.title}`,
      result.id,
      "AbsenceRequest",
    );

    return result;
  }

  async findAbsencesByMeeting(meetingId: string, actor: Actor) {
    const meeting = await this.repository.findById(meetingId);

    if (!meeting) {
      throw new AppError("Meeting not found", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    const isParticipant = meeting.participants.some((p) => p.userId === actor.id);
    if (
      actor.role !== "ADMIN" &&
      actor.id !== meeting.createdBy &&
      actor.id !== meeting.hostId &&
      !isParticipant
    ) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    return this.repository.findAbsencesByMeeting(meetingId);
  }

  async reviewAbsence(absenceId: string, actor: Actor, data: ReviewAbsenceDto) {
    const absence = await this.repository.findAbsenceRequest(absenceId);

    if (!absence) {
      throw new AppError("Absence request not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (absence.status !== "PENDING") {
      throw new AppError(
        "This absence request has already been reviewed",
        400,
        ERROR_CODE.ABSENCE_ALREADY_REVIEWED,
      );
    }

    if (
      actor.role !== "ADMIN" &&
      actor.id !== absence.meeting.createdBy &&
      actor.id !== absence.meeting.hostId
    ) {
      throw new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN);
    }

    const result = await this.repository.reviewAbsenceRequest(
      absenceId,
      data.status,
      actor.id,
      data.reviewNote,
    );

    // If approved, auto-decline invitation and mark absent
    if (data.status === "APPROVED") {
      const participantUserId = absence.participant.userId;
      await this.repository.updateParticipantRsvp(
        absence.meetingId,
        participantUserId,
        "DECLINED",
      );
      await this.repository.updateParticipantAttendance(
        absence.meetingId,
        participantUserId,
        "ABSENT",
      );
    }

    const userName = absence.participant.user.fullName || absence.participant.user.email;

    await this.activityLogService.log(
      actor.id,
      ACTIVITY_ACTIONS.REVIEW_ABSENCE,
      `${data.status === "APPROVED" ? "Approved" : "Rejected"} absence request for ${userName}`,
      absenceId,
      "AbsenceRequest",
    );

    return result;
  }
}
