import {
  MeetingType,
  MeetingStatus,
  MeetingVisibility,
  ParticipantRole,
  InvitationStatus,
  AttendanceStatus,
  AbsenceStatus,
} from "@prisma/client";

export interface ParticipantInputDto {
  userId: string;
  participantRole?: ParticipantRole;
}

export interface CreateMeetingDto {
  title: string;
  description?: string;
  minutes?: string;
  hostId?: string;
  location?: string;
  meetingType: MeetingType;
  meetingLink?: string;
  startTime: Date | string;
  endTime: Date | string;
  status?: MeetingStatus;
  visibility?: MeetingVisibility;
  participants?: ParticipantInputDto[];
}

export interface UpdateMeetingDto {
  title?: string;
  description?: string;
  minutes?: string;
  hostId?: string;
  location?: string;
  meetingType?: MeetingType;
  meetingLink?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  status?: MeetingStatus;
  visibility?: MeetingVisibility;
}

export interface InviteParticipantsDto {
  participants: ParticipantInputDto[];
}

export interface RsvpMeetingDto {
  status: "ACCEPTED" | "DECLINED";
}

export interface SubmitAbsenceDto {
  reason: string;
  attachmentUrl?: string;
}

export interface ReviewAbsenceDto {
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
}

export interface MeetingQueryDto {
  status?: MeetingStatus;
  meetingType?: MeetingType;
  visibility?: MeetingVisibility;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: "startTime" | "createdAt" | "title";
  order?: "asc" | "desc";
}

export interface BusyUsersQueryDto {
  startTime: string;
  endTime: string;
  excludeMeetingId?: string;
}
