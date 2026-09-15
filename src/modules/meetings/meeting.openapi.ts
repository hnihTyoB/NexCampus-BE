import { openapiRegistry } from "../../config/openapi/openapi.registry";
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
import { z } from "zod";

export function registerMeetingOpenApi(): void {
  openapiRegistry.register("CreateMeetingRequest", createMeetingSchema);
  openapiRegistry.register("UpdateMeetingRequest", updateMeetingSchema);
  openapiRegistry.register("InviteParticipantsRequest", inviteParticipantsSchema);
  openapiRegistry.register("RsvpMeetingRequest", rsvpSchema);
  openapiRegistry.register("SubmitAbsenceRequest", submitAbsenceSchema);
  openapiRegistry.register("ReviewAbsenceRequest", reviewAbsenceSchema);

  // GET /meetings/busy-users
  openapiRegistry.registerPath({
    method: "get",
    path: "/meetings/busy-users",
    tags: ["Meetings"],
    summary: "Kiểm tra danh sách người bận / trùng lịch họp trong khoảng thời gian",
    security: [{ BearerAuth: [] }],
    request: { query: getBusyUsersSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(z.record(z.unknown())),
            }),
          },
        },
      },
    },
  });

  // GET /meetings
  openapiRegistry.registerPath({
    method: "get",
    path: "/meetings",
    tags: ["Meetings"],
    summary: "Lấy danh sách cuộc họp (lọc theo ngày, trạng thái, hình thức)",
    security: [{ BearerAuth: [] }],
    request: { query: findAllMeetingSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(z.record(z.unknown())),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /meetings
  openapiRegistry.registerPath({
    method: "post",
    path: "/meetings",
    tags: ["Meetings"],
    summary: "Tạo cuộc họp mới (Admin/Leader)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createMeetingSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo cuộc họp thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Lỗi dữ liệu đầu vào hoặc startTime >= endTime" },
      403: { description: "Thực tập sinh không có quyền lên lịch họp" },
    },
  });

  // GET /meetings/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/meetings/{id}",
    tags: ["Meetings"],
    summary: "Xem chi tiết cuộc họp, người tham gia và biên bản cuộc họp",
    security: [{ BearerAuth: [] }],
    request: { params: meetingIdParamSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy cuộc họp" },
    },
  });

  // PUT /meetings/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/meetings/{id}",
    tags: ["Meetings"],
    summary: "Cập nhật thông tin cuộc họp hoặc biên bản họp",
    security: [{ BearerAuth: [] }],
    request: {
      params: meetingIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateMeetingSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Cuộc họp đã kết thúc hoặc hủy" },
    },
  });

  // DELETE /meetings/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/meetings/{id}",
    tags: ["Meetings"],
    summary: "Xóa hoặc hủy cuộc họp",
    security: [{ BearerAuth: [] }],
    request: { params: meetingIdParamSchema },
    responses: {
      200: {
        description: "Xóa cuộc họp thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
            }),
          },
        },
      },
    },
  });

  // POST /meetings/:id/participants
  openapiRegistry.registerPath({
    method: "post",
    path: "/meetings/{id}/participants",
    tags: ["Meetings"],
    summary: "Mời thêm thành viên vào cuộc họp",
    security: [{ BearerAuth: [] }],
    request: {
      params: meetingIdParamSchema,
      body: {
        content: {
          "application/json": { schema: inviteParticipantsSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Mời thành viên thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(z.record(z.unknown())),
            }),
          },
        },
      },
    },
  });

  // POST /meetings/:id/rsvp
  openapiRegistry.registerPath({
    method: "post",
    path: "/meetings/{id}/rsvp",
    tags: ["Meetings"],
    summary: "Người được mời phản hồi tham gia (ACCEPTED hoặc DECLINED)",
    security: [{ BearerAuth: [] }],
    request: {
      params: meetingIdParamSchema,
      body: {
        content: {
          "application/json": { schema: rsvpSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Phản hồi thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // POST /meetings/:id/join
  openapiRegistry.registerPath({
    method: "post",
    path: "/meetings/{id}/join",
    tags: ["Meetings"],
    summary: "Điểm danh tham gia cuộc họp",
    security: [{ BearerAuth: [] }],
    request: { params: meetingIdParamSchema },
    responses: {
      200: {
        description: "Điểm danh thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // POST /meetings/:id/absences
  openapiRegistry.registerPath({
    method: "post",
    path: "/meetings/{id}/absences",
    tags: ["Meetings"],
    summary: "Gửi đơn xin vắng mặt cuộc họp kèm lý do",
    security: [{ BearerAuth: [] }],
    request: {
      params: meetingIdParamSchema,
      body: {
        content: {
          "application/json": { schema: submitAbsenceSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Gửi đơn xin vắng mặt thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Đã gửi đơn xin vắng mặt trước đó" },
    },
  });

  // PUT /meetings/absences/:absenceId/review
  openapiRegistry.registerPath({
    method: "put",
    path: "/meetings/absences/{absenceId}/review",
    tags: ["Meetings"],
    summary: "Leader/Admin phê duyệt hoặc từ chối đơn xin vắng mặt cuộc họp",
    security: [{ BearerAuth: [] }],
    request: {
      params: absenceIdParamSchema,
      body: {
        content: {
          "application/json": { schema: reviewAbsenceSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Xử lý đơn xin vắng mặt thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Đơn đã được xử lý trước đó" },
    },
  });
}
