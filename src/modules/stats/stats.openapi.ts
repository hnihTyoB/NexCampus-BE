import { openapiRegistry } from "../../config/openapi/openapi.registry";
import { internStatsQuerySchema } from "./stats.validation";
import { z } from "zod";

export function registerStatsOpenApi(): void {
  // GET /stats/admin
  openapiRegistry.registerPath({
    method: "get",
    path: "/stats/admin",
    tags: ["Dashboard & Stats"],
    summary: "Thống kê tổng quan toàn hệ thống (Yêu cầu quyền STATS_ADMIN_READ)",
    security: [{ BearerAuth: [] }],
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

  // GET /stats/leader
  openapiRegistry.registerPath({
    method: "get",
    path: "/stats/leader",
    tags: ["Dashboard & Stats"],
    summary: "Thống kê hiệu suất quản lý (Yêu cầu quyền STATS_LEADER_READ)",
    security: [{ BearerAuth: [] }],
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

  // GET /stats/intern
  openapiRegistry.registerPath({
    method: "get",
    path: "/stats/intern",
    tags: ["Dashboard & Stats"],
    summary: "Thống kê cá nhân (Yêu cầu quyền STATS_INTERN_READ)",
    security: [{ BearerAuth: [] }],
    request: { query: internStatsQuerySchema },
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
}
