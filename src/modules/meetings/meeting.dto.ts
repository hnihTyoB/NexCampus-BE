import { MeetingType, MeetingStatus, MeetingVisibility } from "@prisma/client";

export interface MeetingQueryDto {
  title?: string;
  status?: MeetingStatus;
  meetingType?: MeetingType;
  visibility?: MeetingVisibility;
  createdBy?: string;
  hostId?: string;
  participantId?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  endTimeFrom?: string;
  endTimeTo?: string;
  sortBy?: "createdAt" | "startTime" | "title";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateMeetingDto {
  title: string;
  description?: string;
  hostId: string;
  location?: string;
  meetingType: MeetingType;
  meetingLink?: string;
  startTime: string;
  endTime: string;
  status?: MeetingStatus;
  visibility?: MeetingVisibility;
  participantIds?: string[];
}

export interface UpdateMeetingDto {
  title?: string;
  description?: string | null;
  hostId?: string;
  location?: string | null;
  meetingType?: MeetingType;
  meetingLink?: string | null;
  startTime?: string;
  endTime?: string;
  status?: MeetingStatus;
  visibility?: MeetingVisibility;
}

export interface InviteParticipantsDto {
  participantIds: string[];
}

export interface RsvpDto {
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
