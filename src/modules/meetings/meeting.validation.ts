import { z } from "zod";
import {
  MeetingType,
  MeetingStatus,
  MeetingVisibility,
  ParticipantRole,
  AttendanceStatus,
} from "@prisma/client";

export const meetingIdParamSchema = z.object({
  id: z.string().uuid("Invalid meeting ID"),
});

export const absenceIdParamSchema = z.object({
  absenceId: z.string().uuid("Invalid absence ID"),
});

export const findAllMeetingSchema = z.object({
  status: z.nativeEnum(MeetingStatus).optional(),
  meetingType: z.nativeEnum(MeetingType).optional(),
  visibility: z.nativeEnum(MeetingVisibility).optional(),
  departmentId: z.string().uuid("Invalid department ID").optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  sortBy: z.enum(["startTime", "createdAt", "title"]).optional().default("startTime"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const participantInputSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  participantRole: z.nativeEnum(ParticipantRole).optional().default(ParticipantRole.PARTICIPANT),
});

export const createMeetingSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(255),
    description: z.string().trim().max(3000).optional(),
    minutes: z.string().trim().max(10000).optional(),
    hostId: z.string().uuid("Invalid host ID").optional(),
    departmentId: z.string().uuid("Invalid department ID").optional(),
    location: z.string().trim().max(255).optional(),
    meetingType: z.nativeEnum(MeetingType).default(MeetingType.ONLINE),
    meetingLink: z.string().trim().url("meetingLink must be a valid URL").optional().or(z.literal("")),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    status: z.nativeEnum(MeetingStatus).optional().default(MeetingStatus.SCHEDULED),
    visibility: z.nativeEnum(MeetingVisibility).optional().default(MeetingVisibility.TEAM),
    participants: z.array(participantInputSchema).optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Thời gian bắt đầu (startTime) phải trước thời gian kết thúc (endTime)",
    path: ["endTime"],
  })
  .refine(
    (data) => {
      // Cho phép độ trễ 5 phút để tránh network drift
      if (process.env.NODE_ENV === "test") return true;
      return data.startTime.getTime() >= Date.now() - 5 * 60 * 1000;
    },
    {
      message: "Không thể đặt lịch họp trong quá khứ",
      path: ["startTime"],
    },
  );

export const updateMeetingSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(3000).optional(),
    minutes: z.string().trim().max(10000).optional(),
    hostId: z.string().uuid("Invalid host ID").optional(),
    departmentId: z.string().uuid("Invalid department ID").optional(),
    location: z.string().trim().max(255).optional(),
    meetingType: z.nativeEnum(MeetingType).optional(),
    meetingLink: z.string().trim().url().optional().or(z.literal("")),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    status: z.nativeEnum(MeetingStatus).optional(),
    visibility: z.nativeEnum(MeetingVisibility).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: "Thời gian bắt đầu (startTime) phải trước thời gian kết thúc (endTime)",
      path: ["endTime"],
    },
  );

export const updateMeetingAttendanceSchema = z.object({
  minutes: z.string().trim().max(10000).optional(),
  attendances: z
    .array(
      z
        .object({
          userId: z.string().uuid("Invalid user ID"),
          attendanceStatus: z.nativeEnum(AttendanceStatus).optional(),
          status: z
            .enum(["PENDING", "ACCEPTED", "DECLINED", "ATTENDED", "ABSENT", "EXCUSED"])
            .optional(),
          notes: z.string().trim().max(1000).optional(),
        })
        .refine(
          (val) => val.attendanceStatus !== undefined || val.status !== undefined,
          {
            message:
              "attendanceStatus hoặc status là bắt buộc cho từng người tham gia",
          },
        )
        .transform((val) => {
          const attendanceStatus = (val.attendanceStatus ||
            (val.status === "ACCEPTED" || val.status === "ATTENDED"
              ? AttendanceStatus.ATTENDED
              : val.status === "DECLINED" || val.status === "ABSENT"
                ? AttendanceStatus.ABSENT
                : AttendanceStatus.UNKNOWN)) as AttendanceStatus;
          return {
            userId: val.userId,
            attendanceStatus,
            notes: val.notes,
          };
        }),
    )
    .optional(),
});

export type UpdateMeetingAttendanceInput = z.infer<
  typeof updateMeetingAttendanceSchema
>;

export const inviteParticipantsSchema = z.object({
  participants: z
    .array(participantInputSchema)
    .min(1, "Danh sách người tham gia không được rỗng"),
});

export const rsvpSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export const submitAbsenceSchema = z.object({
  reason: z.string().trim().min(1, "Lý do xin vắng mặt là bắt buộc").max(2000),
  attachmentUrl: z.string().trim().url("attachmentUrl must be a valid URL").optional().or(z.literal("")),
});

export const reviewAbsenceSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

export const getBusyUsersSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    excludeMeetingId: z.string().uuid().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });
