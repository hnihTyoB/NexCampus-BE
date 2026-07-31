import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  MeetingQueryDto,
  CreateMeetingDto,
  UpdateMeetingDto,
} from "./meeting.dto";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
};

const participantSelect = {
  id: true,
  meetingId: true,
  userId: true,
  participantRole: true,
  invitationStatus: true,
  attendanceStatus: true,
  responseAt: true,
  joinedAt: true,
  leftAt: true,
  user: { select: userSelect },
};

const defaultSelect = {
  id: true,
  title: true,
  description: true,
  createdBy: true,
  hostId: true,
  location: true,
  meetingType: true,
  meetingLink: true,
  startTime: true,
  endTime: true,
  status: true,
  visibility: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: userSelect },
  host: { select: userSelect },
  participants: { select: participantSelect },
  _count: { select: { participants: true, absences: true } },
};

export class MeetingRepository {
  private async syncMeetingStatuses() {
    const now = new Date();
    await prisma.$transaction([
      prisma.meeting.updateMany({
        where: {
          status: "SCHEDULED",
          startTime: { lte: now },
          deletedAt: null,
        },
        data: { status: "ONGOING" },
      }),
      prisma.meeting.updateMany({
        where: {
          status: "ONGOING",
          endTime: { lte: now },
          deletedAt: null,
        },
        data: { status: "COMPLETED" },
      }),
    ]);
  }

  async findAll(
    query: MeetingQueryDto,
    actorId: string,
    actorRole: string,
  ) {
    await this.syncMeetingStatuses();

    const {
      title,
      status,
      meetingType,
      visibility,
      createdBy,
      hostId,
      participantId,
      startTimeFrom,
      startTimeTo,
      endTimeFrom,
      endTimeTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const filters: Prisma.MeetingWhereInput[] = [{ deletedAt: null }];

    if (title) {
      filters.push({ title: { contains: title, mode: "insensitive" } });
    }
    if (status) filters.push({ status });
    if (meetingType) filters.push({ meetingType });
    if (visibility) filters.push({ visibility });
    if (createdBy) filters.push({ createdBy });
    if (hostId) filters.push({ hostId });

    if (startTimeFrom || startTimeTo) {
      filters.push({
        startTime: {
          ...(startTimeFrom ? { gte: new Date(startTimeFrom) } : {}),
          ...(startTimeTo ? { lte: new Date(startTimeTo) } : {}),
        },
      });
    }
    if (endTimeFrom || endTimeTo) {
      filters.push({
        endTime: {
          ...(endTimeFrom ? { gte: new Date(endTimeFrom) } : {}),
          ...(endTimeTo ? { lte: new Date(endTimeTo) } : {}),
        },
      });
    }

    // Role-based row-level filtering
    if (actorRole === "ADMIN") {
      // Admin sees all non-deleted meetings
    } else if (actorRole === "LEADER") {
      filters.push({
        OR: [
          { createdBy: actorId },
          { hostId: actorId },
          { participants: { some: { userId: actorId } } },
          { visibility: "TEAM" },
        ],
      });
    } else if (actorRole === "INTERN") {
      filters.push({
        OR: [
          { participants: { some: { userId: actorId } } },
          { visibility: "TEAM" },
        ],
      });
    }

    if (participantId) {
      filters.push({
        participants: { some: { userId: participantId } },
      });
    }

    const where: Prisma.MeetingWhereInput = { AND: filters };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.meeting.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.meeting.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    await this.syncMeetingStatuses();
    return prisma.meeting.findFirst({
      where: { id, deletedAt: null },
      select: defaultSelect,
    });
  }

  findByTimeRange(
    hostId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ) {
    return prisma.meeting.findMany({
      where: {
        hostId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, title: true, startTime: true, endTime: true },
    });
  }

  create(data: CreateMeetingDto, createdBy: string) {
    const participants: { userId: string; participantRole: string; invitationStatus: string }[] = [];

    // Creator as ORGANIZER (auto-accepted)
    participants.push({
      userId: createdBy,
      participantRole: "ORGANIZER",
      invitationStatus: "ACCEPTED",
    });

    // Host as HOST (auto-accepted), if different from creator
    if (data.hostId !== createdBy) {
      participants.push({
        userId: data.hostId,
        participantRole: "HOST",
        invitationStatus: "ACCEPTED",
      });
    } else {
      // Creator is also the host — update their role to HOST
      participants[0].participantRole = "HOST";
    }

    // Invited participants
    if (data.participantIds?.length) {
      for (const userId of data.participantIds) {
        if (userId !== createdBy && userId !== data.hostId) {
          participants.push({
            userId,
            participantRole: "PARTICIPANT",
            invitationStatus: "PENDING",
          });
        }
      }
    }

    return prisma.meeting.create({
      data: {
        title: data.title,
        description: data.description,
        hostId: data.hostId,
        location: data.location,
        meetingType: data.meetingType,
        meetingLink: data.meetingLink,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status || "SCHEDULED",
        visibility: data.visibility || "TEAM",
        createdBy,
        participants: {
          create: participants.map((p) => ({
            userId: p.userId,
            participantRole: p.participantRole as any,
            invitationStatus: p.invitationStatus as any,
          })),
        },
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateMeetingDto) {
    return prisma.meeting.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.hostId !== undefined ? { hostId: data.hostId } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.meetingType !== undefined
          ? { meetingType: data.meetingType }
          : {}),
        ...(data.meetingLink !== undefined
          ? { meetingLink: data.meetingLink }
          : {}),
        ...(data.startTime !== undefined
          ? { startTime: new Date(data.startTime) }
          : {}),
        ...(data.endTime !== undefined
          ? { endTime: new Date(data.endTime) }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.visibility !== undefined
          ? { visibility: data.visibility }
          : {}),
      },
      select: defaultSelect,
    });
  }

  softDelete(id: string) {
    return prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: defaultSelect,
    });
  }

  // ── Participants ──────────────────────────────────────────────────────

  addParticipants(meetingId: string, userIds: string[]) {
    return prisma.meetingParticipant.createMany({
      data: userIds.map((userId) => ({
        meetingId,
        userId,
        participantRole: "PARTICIPANT",
      })),
      skipDuplicates: true,
    });
  }

  findParticipant(meetingId: string, userId: string) {
    return prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
      select: participantSelect,
    });
  }

  updateParticipantRsvp(
    meetingId: string,
    userId: string,
    invitationStatus: string,
  ) {
    return prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: {
        invitationStatus: invitationStatus as any,
        responseAt: new Date(),
      },
      select: participantSelect,
    });
  }

  updateParticipantJoin(meetingId: string, userId: string) {
    return prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: {
        invitationStatus: "ACCEPTED",
        attendanceStatus: "ATTENDED",
        joinedAt: new Date(),
        responseAt: new Date(),
      },
      select: participantSelect,
    });
  }

  updateParticipantLeave(meetingId: string, userId: string) {
    return prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { leftAt: new Date() },
      select: participantSelect,
    });
  }

  updateParticipantAttendance(
    meetingId: string,
    userId: string,
    attendanceStatus: string,
  ) {
    return prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { attendanceStatus: attendanceStatus as any },
      select: participantSelect,
    });
  }

  // ── Absence Requests ──────────────────────────────────────────────────

  createAbsenceRequest(participantId: string, meetingId: string, reason: string, attachmentUrl?: string) {
    return prisma.absenceRequest.create({
      data: { participantId, meetingId, reason, attachmentUrl },
      select: {
        id: true,
        meetingId: true,
        participantId: true,
        reason: true,
        attachmentUrl: true,
        status: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNote: true,
        createdAt: true,
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });
  }

  findAbsenceRequest(id: string) {
    return prisma.absenceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        meetingId: true,
        participantId: true,
        reason: true,
        attachmentUrl: true,
        status: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reviewer: { select: { id: true, email: true, fullName: true } },
        meeting: { select: { id: true, title: true, createdBy: true, hostId: true } },
      },
    });
  }

  findAbsenceByMeetingAndParticipant(meetingId: string, participantId: string) {
    return prisma.absenceRequest.findUnique({
      where: { meetingId_participantId: { meetingId, participantId } },
    });
  }

  findAbsencesByMeeting(meetingId: string) {
    return prisma.absenceRequest.findMany({
      where: { meetingId },
      select: {
        id: true,
        meetingId: true,
        participantId: true,
        reason: true,
        attachmentUrl: true,
        status: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNote: true,
        createdAt: true,
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reviewer: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  reviewAbsenceRequest(
    id: string,
    status: string,
    reviewedBy: string,
    reviewNote?: string,
  ) {
    return prisma.absenceRequest.update({
      where: { id },
      data: {
        status: status as any,
        reviewedBy,
        reviewedAt: new Date(),
        ...(reviewNote !== undefined ? { reviewNote } : {}),
      },
      select: {
        id: true,
        meetingId: true,
        participantId: true,
        reason: true,
        attachmentUrl: true,
        status: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNote: true,
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reviewer: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async findAbsencesByUser(userId: string) {
    return prisma.absenceRequest.findMany({
      where: {
        participant: { userId },
        status: "APPROVED",
      },
      select: { meetingId: true, status: true },
    });
  }

  async findAllAbsences() {
    return prisma.absenceRequest.findMany({
      select: {
        id: true,
        meetingId: true,
        participantId: true,
        reason: true,
        attachmentUrl: true,
        status: true,
        createdAt: true,
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        meeting: {
          select: { id: true, title: true, createdBy: true, hostId: true },
        },
      },
      orderBy: { createdAt: "desc" as const },
    });
  }
}
