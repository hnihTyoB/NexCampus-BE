import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  createRegulationSchema,
  updateRegulationSchema,
  regulationQuerySchema,
  regulationIdParamSchema,
} from "./regulation.validation";
import { z } from "zod";

export function registerRegulationOpenApi(): void {
  // GET /regulations
  openapiRegistry.registerPath({
    method: "get",
    path: "/regulations",
    tags: ["Regulations"],
    summary: "Lấy danh sách nội quy và chính sách thực tập",
    security: [{ BearerAuth: [] }],
    request: { query: regulationQuerySchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              items: z.array(z.record(z.any())),
            }),
          },
        },
      },
    },
  });

  // GET /regulations/active
  openapiRegistry.registerPath({
    method: "get",
    path: "/regulations/active",
    tags: ["Regulations"],
    summary: "Lấy nội quy đang có hiệu lực áp dụng",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.any()),
            }),
          },
        },
      },
    },
  });

  // POST /regulations/:id/acknowledge
  openapiRegistry.registerPath({
    method: "post",
    path: "/regulations/{id}/acknowledge",
    tags: ["Regulations"],
    summary: "TTS xác nhận đã đọc và cam kết tuân thủ nội quy",
    security: [{ BearerAuth: [] }],
    request: { params: regulationIdParamSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              data: z.record(z.any()),
            }),
          },
        },
      },
    },
  });

  // POST /regulations
  openapiRegistry.registerPath({
    method: "post",
    path: "/regulations",
    tags: ["Regulations"],
    summary: "Tạo nội quy mới (Yêu cầu quyền REGULATION_CREATE)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createRegulationSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              data: z.record(z.any()),
            }),
          },
        },
      },
    },
  });
}
