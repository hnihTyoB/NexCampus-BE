import { Prisma, MeetingStatus, MeetingType, MeetingVisibility, InvitationStatus, AttendanceStatus, AbsenceStatus, ParticipantRole } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  MeetingQueryDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  ParticipantInputDto,
} from "./meeting.dto";
import { SYSTEM_TARGET_ID } from "../../common/constants/audit-log.constant";

const defaultMeetingSelect = {
  id: true,
  title: true,
  description: true,
  minutes: true,
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
  creator: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  host: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  participants: {
    select: {
      id: true,
      userId: true,
      participantRole: true,
      invitationStatus: true,
      attendanceStatus: true,
      responseAt: true,
      joinedAt: true,
      leftAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: {
    select: {
      participants: true,
      absences: true,
    },
  },
};

export class MeetingRepository {
  async findAll(
    query: MeetingQueryDto,
    scope?: {
      userId?: string;
      role?: string;
    },
  ) {
    const {
      status,
      meetingType,
      visibility,
      startDate,
      endDate,
      sortBy = "startTime",
      order = "asc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.MeetingWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(meetingType ? { meetingType } : {}),
      ...(visibility ? { visibility } : {}),
      ...(startDate || endDate
        ? {
            startTime: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(scope?.role === "INTERN" && scope?.userId
        ? {
            OR: [
              { participants: { some: { userId: scope.userId } } },
              { visibility: MeetingVisibility.TEAM },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        select: defaultMeetingSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.meeting.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...defaultMeetingSelect,
        absences: {
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
                userId: true,
                user: {
                  select: { id: true, email: true, fullName: true },
                },
              },
            },
            reviewer: {
              select: { id: true, email: true, fullName: true },
            },
          },
        },
      },
    });
  }

  async create(data: CreateMeetingDto, creatorId: string) {
    const hostId = data.hostId || creatorId;

    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          title: data.title,
          description: data.description || null,
          minutes: data.minutes || null,
          createdBy: creatorId,
          hostId,
          location: data.location || null,
          meetingType: data.meetingType,
          meetingLink: data.meetingLink || null,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          status: data.status || MeetingStatus.SCHEDULED,
          visibility: data.visibility || MeetingVisibility.TEAM,
        },
        select: defaultMeetingSelect,
      });

      // Prepare participant list: include host and creator automatically
      const participantMap = new Map<string, ParticipantRole>();
      participantMap.set(hostId, ParticipantRole.HOST);
      if (creatorId !== hostId) {
        participantMap.set(creatorId, ParticipantRole.ORGANIZER);
      }

      if (data.participants && data.participants.length > 0) {
        for (const p of data.participants) {
          if (!participantMap.has(p.userId)) {
            participantMap.set(p.userId, p.participantRole || ParticipantRole.PARTICIPANT);
          }
        }
      }

      const participantRecords = Array.from(participantMap.entries()).map(
        ([userId, role]) => ({
          meetingId: meeting.id,
          userId,
          participantRole: role,
          invitationStatus:
            userId === hostId || userId === creatorId
              ? InvitationStatus.ACCEPTED
              : InvitationStatus.PENDING,
          responseAt:
            userId === hostId || userId === creatorId ? new Date() : null,
        }),
      );

      await tx.meetingParticipant.createMany({
        data: participantRecords,
        skipDuplicates: true,
      });

      return tx.meeting.findUnique({
        where: { id: meeting.id },
        select: defaultMeetingSelect,
      });
    });
  }

  async update(id: string, data: UpdateMeetingDto) {
    return prisma.meeting.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        minutes: data.minutes,
        hostId: data.hostId,
        location: data.location,
        meetingType: data.meetingType,
        meetingLink: data.meetingLink,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        status: data.status,
        visibility: data.visibility,
      },
      select: defaultMeetingSelect,
    });
  }

  async delete(id: string) {
    return prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findParticipant(meetingId: string, userId: string) {
    return prisma.meetingParticipant.findUnique({
      where: {
        meetingId_userId: { meetingId, userId },
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async inviteParticipants(meetingId: string, participants: ParticipantInputDto[]) {
    const records = participants.map((p) => ({
      meetingId,
      userId: p.userId,
      participantRole: p.participantRole || ParticipantRole.PARTICIPANT,
      invitationStatus: InvitationStatus.PENDING,
    }));

    await prisma.meetingParticipant.createMany({
      data: records,
      skipDuplicates: true,
    });

    return prisma.meetingParticipant.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
      },
    });
  }

  async updateParticipantRsvp(
    meetingId: string,
    userId: string,
    status: "ACCEPTED" | "DECLINED",
  ) {
    return prisma.meetingParticipant.update({
      where: {
        meetingId_userId: { meetingId, userId },
      },
      data: {
        invitationStatus: status as InvitationStatus,
        responseAt: new Date(),
      },
    });
  }

  async updateParticipantAttendance(
    meetingId: string,
    userId: string,
    attendanceStatus: "ATTENDED" | "ABSENT",
    joinedAt?: Date,
  ) {
    return prisma.meetingParticipant.update({
      where: {
        meetingId_userId: { meetingId, userId },
      },
      data: {
        attendanceStatus: attendanceStatus as AttendanceStatus,
        ...(joinedAt ? { joinedAt } : {}),
      },
    });
  }

  async findBusyUsers(
    startTime: Date,
    endTime: Date,
    excludeMeetingId?: string,
  ) {
    const overlappingParticipants = await prisma.meetingParticipant.findMany({
      where: {
        ...(excludeMeetingId ? { meetingId: { not: excludeMeetingId } } : {}),
        invitationStatus: { not: InvitationStatus.DECLINED },
        meeting: {
          deletedAt: null,
          status: { notIn: [MeetingStatus.CANCELLED, MeetingStatus.DRAFT] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      },
      select: {
        userId: true,
        meetingId: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    return overlappingParticipants;
  }

  // ── Absence Requests ──────────────────────────────────────────────────────

  async createAbsenceRequest(
    participantId: string,
    meetingId: string,
    reason: string,
    attachmentUrl?: string,
  ) {
    return prisma.absenceRequest.create({
      data: {
        meetingId,
        participantId,
        reason,
        attachmentUrl: attachmentUrl || null,
        status: AbsenceStatus.PENDING,
      },
      include: {
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

  async findAbsenceByMeetingAndParticipant(
    meetingId: string,
    participantId: string,
  ) {
    return prisma.absenceRequest.findUnique({
      where: {
        meetingId_participantId: { meetingId, participantId },
      },
    });
  }

  async findAbsenceRequest(absenceId: string) {
    return prisma.absenceRequest.findUnique({
      where: { id: absenceId },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            createdBy: true,
            hostId: true,
          },
        },
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reviewer: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });
  }

  async findAbsencesByMeeting(meetingId: string) {
    return prisma.absenceRequest.findMany({
      where: { meetingId },
      include: {
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reviewer: {
          select: { id: true, email: true, fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findMyAbsences(userId: string) {
    return prisma.absenceRequest.findMany({
      where: {
        participant: { userId },
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            meetingType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPendingAbsences(scope?: { leaderUserId?: string }) {
    return prisma.absenceRequest.findMany({
      where: {
        status: AbsenceStatus.PENDING,
        ...(scope?.leaderUserId
          ? {
              OR: [
                { meeting: { hostId: scope.leaderUserId } },
                { meeting: { createdBy: scope.leaderUserId } },
              ],
            }
          : {}),
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
          },
        },
        participant: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async reviewAbsenceRequest(
    absenceId: string,
    status: "APPROVED" | "REJECTED",
    reviewedBy: string,
    reviewNote?: string,
  ) {
    return prisma.absenceRequest.update({
      where: { id: absenceId },
      data: {
        status: status as AbsenceStatus,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      include: {
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

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || SYSTEM_TARGET_ID,
        details: data.details as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
      },
    });
  }
}
