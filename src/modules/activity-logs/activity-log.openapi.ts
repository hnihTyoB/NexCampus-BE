import { z } from "zod";
import { openapiRegistry } from "../../config/openapi/openapi.registry";
import { queryActivityLogSchema } from "./activity-log.validation";

export function registerActivityLogOpenApi(): void {
  const activityLogResponseSchema = z.object({
    id: z.string().uuid(),
    actorId: z.string().uuid().nullable().optional(),
    action: z.string(),
    targetType: z.string(),
    targetId: z.string(),
    details: z.record(z.unknown()).nullable().optional(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    actor: z
      .object({
        id: z.string().uuid(),
        email: z.string().nullable().optional(),
        fullName: z.string().nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  });

  openapiRegistry.register("ActivityLogResponse", activityLogResponseSchema);

  openapiRegistry.registerPath({
    method: "get",
    path: "/activity-logs",
    tags: ["Activity Logs"],
    summary: "Tra cứu nhật ký hoạt động hệ thống (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      query: queryActivityLogSchema,
    },
    responses: {
      200: {
        description: "Lấy danh sách nhật ký thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              items: z.array(activityLogResponseSchema),
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/activity-logs/{id}",
    tags: ["Activity Logs"],
    summary: "Chi tiết nhật ký hoạt động hệ thống (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        description: "Lấy chi tiết nhật ký thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: activityLogResponseSchema,
            }),
          },
        },
      },
    },
  });
}
