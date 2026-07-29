import { z } from "zod";

export const findAllMeetingSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  meetingType: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
  visibility: z.enum(["PRIVATE", "TEAM"]).optional(),
  createdBy: z.string().uuid().optional(),
  hostId: z.string().uuid().optional(),
  participantId: z.string().uuid().optional(),
  startTimeFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startTimeFrom" })
    .optional(),
  startTimeTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startTimeTo" })
    .optional(),
  endTimeFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid endTimeFrom" })
    .optional(),
  endTimeTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid endTimeTo" })
    .optional(),
  sortBy: z.enum(["createdAt", "startTime", "title"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createMeetingSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    hostId: z.string().uuid(),
    location: z.string().max(255).optional(),
    meetingType: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
    meetingLink: z.string().optional(),
    startTime: z.string().refine((v) => !isNaN(Date.parse(v)), {
      message: "Invalid startTime",
    }),
    endTime: z.string().refine((v) => !isNaN(Date.parse(v)), {
      message: "Invalid endTime",
    }),
    status: z.enum(["DRAFT", "SCHEDULED"]).optional(),
    visibility: z.enum(["PRIVATE", "TEAM"]).optional(),
    participantIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return start < end;
    },
    { message: "startTime must be before endTime", path: ["endTime"] },
  );

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  hostId: z.string().uuid().optional(),
  location: z.string().max(255).nullable().optional(),
  meetingType: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
  meetingLink: z.string().nullable().optional(),
  startTime: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startTime" })
    .optional(),
  endTime: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid endTime" })
    .optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  visibility: z.enum(["PRIVATE", "TEAM"]).optional(),
});

export const inviteParticipantsSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1),
});

export const rsvpSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export const submitAbsenceSchema = z.object({
  reason: z.string().min(1).max(1000),
  attachmentUrl: z.string().url().optional(),
});

export const reviewAbsenceSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(1000).optional(),
});
