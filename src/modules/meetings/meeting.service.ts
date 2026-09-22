import { MeetingRepository } from "./meeting.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  MeetingQueryDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  UpdateMeetingAttendanceDto,
  ParticipantInputDto,
  SubmitAbsenceDto,
  ReviewAbsenceDto,
} from "./meeting.dto";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { prisma } from "../../database/prisma.client";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { MeetingStatus } from "@prisma/client";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class MeetingService {
  private readonly repository = new MeetingRepository();

  private async hasGlobalAccess(actorId: string): Promise<boolean> {
    const callerPerms = new Set(
      await permissionCacheService.getUserPermissions(actorId),
    );
    return (
      callerPerms.has(PERMISSIONS.ROLE_READ) ||
      callerPerms.has(PERMISSIONS.USER_ROLE_ASSIGN)
    );
  }

  async findAll(query: MeetingQueryDto, actor: UserPayload) {
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    const isParticipantScope = !hasGlobal;

    return this.repository.findAll(query, {
      userId: actor.id,
      isParticipantScope,
    });
  }

  async findById(id: string, actor: UserPayload) {
    const meeting = await this.repository.findById(id);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal) {
      const isParticipant =
        meeting.createdBy === actor.id ||
        meeting.hostId === actor.id ||
        meeting.participants.some((p) => p.userId === actor.id);
      if (!isParticipant) {
        throw new AppError(
          "Không có quyền xem cuộc họp này",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    return meeting;
  }

  async create(
    data: CreateMeetingDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const meeting = await this.repository.create(data, actor.id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.CREATE_MEETING,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: meeting?.id,
      details: {
        title: data.title,
        meetingType: data.meetingType,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      ipAddress: context?.ipAddress,
    });

    return meeting;
  }

  async update(
    id: string,
    data: UpdateMeetingDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const meeting = await this.repository.findById(id);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (
      meeting.status === MeetingStatus.COMPLETED ||
      meeting.status === MeetingStatus.CANCELLED
    ) {
      throw new AppError(
        "Không thể chỉnh sửa cuộc họp đã hoàn thành hoặc đã bị hủy",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    const isHostOrCreator =
      actor.id === meeting.createdBy || actor.id === meeting.hostId;
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && !isHostOrCreator) {
      throw new AppError(
        "Bạn không có quyền chỉnh sửa cuộc họp này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const updated = await this.repository.update(id, data);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.UPDATE_MEETING,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: id,
      details: { title: data.title, status: data.status },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }

  async delete(
    id: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const meeting = await this.repository.findById(id);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    const isHostOrCreator =
      actor.id === meeting.createdBy || actor.id === meeting.hostId;
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && !isHostOrCreator) {
      throw new AppError(
        "Bạn không có quyền xóa hoặc hủy cuộc họp này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const deleted = await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.DELETE_MEETING,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: id,
      details: { title: meeting.title },
      ipAddress: context?.ipAddress,
    });

    return deleted;
  }

  async inviteParticipants(
    meetingId: string,
    participants: ParticipantInputDto[],
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    const isHostOrCreator =
      actor.id === meeting.createdBy || actor.id === meeting.hostId;
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && !isHostOrCreator) {
      throw new AppError(
        "Bạn không có quyền mời người tham gia cuộc họp này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.inviteParticipants(meetingId, participants);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.INVITE_PARTICIPANTS,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: meetingId,
      details: { count: participants.length },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async rsvp(
    meetingId: string,
    status: "ACCEPTED" | "DECLINED",
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const participant = await this.repository.findParticipant(meetingId, actor.id);
    if (!participant) {
      throw new AppError(
        "Bạn không có trong danh sách được mời của cuộc họp này",
        403,
        ERROR_CODE.NOT_MEETING_PARTICIPANT,
      );
    }

    const result = await this.repository.updateParticipantRsvp(
      meetingId,
      actor.id,
      status,
    );

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.RSVP_MEETING,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: meetingId,
      details: { status },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async join(
    meetingId: string,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const participant = await this.repository.findParticipant(meetingId, actor.id);
    if (!participant) {
      throw new AppError(
        "Bạn không có trong danh sách tham gia cuộc họp này",
        403,
        ERROR_CODE.NOT_MEETING_PARTICIPANT,
      );
    }

    const result = await this.repository.updateParticipantAttendance(
      meetingId,
      actor.id,
      "ATTENDED",
      new Date(),
    );

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.JOIN_MEETING,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: meetingId,
      details: { joinedAt: new Date() },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async getBusyUsers(
    startTime: Date,
    endTime: Date,
    excludeMeetingId?: string,
  ) {
    const overlaps = await this.repository.findBusyUsers(
      startTime,
      endTime,
      excludeMeetingId,
    );

    const busyMap = new Map<string, {
      userId: string;
      fullName: string | null;
      email: string | null;
      meetings: Array<{ id: string; title: string; startTime: Date; endTime: Date }>;
    }>();

    for (const item of overlaps) {
      if (!busyMap.has(item.userId)) {
        busyMap.set(item.userId, {
          userId: item.userId,
          fullName: item.user.fullName,
          email: item.user.email,
          meetings: [],
        });
      }
      busyMap.get(item.userId)!.meetings.push({
        id: item.meeting.id,
        title: item.meeting.title,
        startTime: item.meeting.startTime,
        endTime: item.meeting.endTime,
      });
    }

    return Array.from(busyMap.values());
  }

  // ── Absence Requests for Meetings ────────────────────────────────────────

  async submitAbsence(
    meetingId: string,
    actor: UserPayload,
    data: SubmitAbsenceDto,
    context?: { ipAddress?: string },
  ) {
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    if (
      meeting.status === MeetingStatus.COMPLETED ||
      meeting.status === MeetingStatus.CANCELLED
    ) {
      throw new AppError(
        "Không thể gửi đơn xin vắng mặt cho cuộc họp đã hoàn thành hoặc đã bị hủy",
        400,
        ERROR_CODE.MEETING_COMPLETED_OR_CANCELLED,
      );
    }

    const participant = await this.repository.findParticipant(meetingId, actor.id);
    if (!participant) {
      throw new AppError(
        "Bạn không có trong danh sách được mời của cuộc họp này",
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
        "Bạn đã gửi yêu cầu xin vắng mặt cho cuộc họp này trước đó",
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

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.SUBMIT_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE_REQUEST,
      targetId: result.id,
      details: { meetingId, reason: data.reason },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async findAbsencesByMeeting(meetingId: string, actor: UserPayload) {
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    return this.repository.findAbsencesByMeeting(meetingId);
  }

  async getMyAbsences(actor: UserPayload) {
    return this.repository.findMyAbsences(actor.id);
  }

  async getPendingAbsences(actor: UserPayload) {
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    let scope: { leaderUserId?: string } | undefined;
    if (!hasGlobal) {
      const leader = await prisma.leader.findFirst({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (leader) {
        scope = { leaderUserId: actor.id };
      }
    }
    return this.repository.findPendingAbsences(scope);
  }

  async reviewAbsence(
    absenceId: string,
    actor: UserPayload,
    data: ReviewAbsenceDto,
    context?: { ipAddress?: string },
  ) {
    const absence = await this.repository.findAbsenceRequest(absenceId);
    if (!absence) {
      throw new AppError(
        "Yêu cầu xin vắng mặt không tồn tại",
        404,
        ERROR_CODE.ABSENCE_NOT_FOUND,
      );
    }

    if (absence.status !== "PENDING") {
      throw new AppError(
        "Yêu cầu xin vắng mặt này đã được xử lý",
        400,
        ERROR_CODE.ABSENCE_ALREADY_REVIEWED,
      );
    }

    const isHostOrCreator =
      actor.id === absence.meeting.createdBy || actor.id === absence.meeting.hostId;
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && !isHostOrCreator) {
      throw new AppError(
        "Chỉ người tổ chức cuộc họp hoặc Quản trị viên mới có quyền phê duyệt đơn xin vắng mặt",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const result = await this.repository.reviewAbsenceRequest(
      absenceId,
      data.status,
      actor.id,
      data.reviewNote,
    );

    // If approved, auto-decline RSVP and mark participant as ABSENT
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

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.REVIEW_ABSENCE,
      targetType: AUDIT_TARGET_TYPE.ABSENCE_REQUEST,
      targetId: absenceId,
      details: { status: data.status, reviewNote: data.reviewNote },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async updateAttendance(
    id: string,
    data: UpdateMeetingAttendanceDto,
    actor: UserPayload,
    context?: { ipAddress?: string },
  ) {
    const meeting = await this.repository.findById(id);
    if (!meeting) {
      throw new AppError("Cuộc họp không tồn tại", 404, ERROR_CODE.MEETING_NOT_FOUND);
    }

    const isHostOrCreator =
      actor.id === meeting.createdBy || actor.id === meeting.hostId;
    const hasGlobal = await this.hasGlobalAccess(actor.id);
    if (!hasGlobal && !isHostOrCreator) {
      throw new AppError(
        "Chỉ người tổ chức cuộc họp hoặc Quản trị viên mới có quyền cập nhật biên bản và điểm danh",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const updated = await this.repository.updateAttendanceAndMinutes(id, data);

    await this.repository.createAuditLog({
      actorId: actor.id,
      action: AUDIT_ACTION.UPDATE_MEETING_ATTENDANCE,
      targetType: AUDIT_TARGET_TYPE.MEETING,
      targetId: id,
      details: {
        minutesUpdated: data.minutes !== undefined,
        attendanceCount: data.attendances?.length ?? 0,
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }
}
