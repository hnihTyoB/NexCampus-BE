import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  absenceIdParamSchema,
  findAllAbsenceSchema,
  createAbsenceSchema,
  reviewGeneralAbsenceSchema,
} from "./absence.validation";
import { z } from "zod";

export function registerAbsenceOpenApi(): void {
  openapiRegistry.register("CreateAbsenceRequest", createAbsenceSchema);
  openapiRegistry.register("ReviewGeneralAbsenceRequest", reviewGeneralAbsenceSchema);

  // GET /absences
  openapiRegistry.registerPath({
    method: "get",
    path: "/absences",
    tags: ["Absences"],
    summary: "Lấy danh sách đơn xin nghỉ/vắng mặt",
    security: [{ BearerAuth: [] }],
    request: { query: findAllAbsenceSchema },
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

  // POST /absences
  openapiRegistry.registerPath({
    method: "post",
    path: "/absences",
    tags: ["Absences"],
    summary: "TTS tạo đơn xin nghỉ/vắng mặt",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createAbsenceSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo đơn xin nghỉ thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Ngày bắt đầu sau ngày kết thúc" },
    },
  });

  // GET /absences/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/absences/{id}",
    tags: ["Absences"],
    summary: "Xem chi tiết đơn xin nghỉ/vắng mặt",
    security: [{ BearerAuth: [] }],
    request: { params: absenceIdParamSchema },
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
      404: { description: "Không tìm thấy đơn xin nghỉ" },
    },
  });

  // POST /absences/:id/review
  openapiRegistry.registerPath({
    method: "post",
    path: "/absences/{id}/review",
    tags: ["Absences"],
    summary: "Leader trực tiếp hoặc Admin phê duyệt / từ chối đơn xin nghỉ",
    security: [{ BearerAuth: [] }],
    request: {
      params: absenceIdParamSchema,
      body: {
        content: {
          "application/json": { schema: reviewGeneralAbsenceSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Phê duyệt đơn xin nghỉ thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Đơn đã được xử lý" },
      403: { description: "Không có quyền phê duyệt" },
    },
  });
}
