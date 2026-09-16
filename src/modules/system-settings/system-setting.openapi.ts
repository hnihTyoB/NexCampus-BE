import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  settingKeyParamSchema,
  updateSystemSettingSchema,
  batchUpdateSystemSettingsSchema,
} from "./system-setting.validation";
import { z } from "zod";

export function registerSystemSettingOpenApi(): void {
  // GET /system-settings
  openapiRegistry.registerPath({
    method: "get",
    path: "/system-settings",
    tags: ["System Settings"],
    summary: "Lấy toàn bộ tham số cài đặt vận hành của hệ thống",
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

  // PUT /system-settings/:key
  openapiRegistry.registerPath({
    method: "put",
    path: "/system-settings/{key}",
    tags: ["System Settings"],
    summary: "Cập nhật tham số cài đặt vận hành (Chỉ dành cho Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: settingKeyParamSchema,
      body: {
        content: {
          "application/json": {
            schema: updateSystemSettingSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              data: z.object({
                key: z.string(),
                value: z.any(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /system-settings/batch
  openapiRegistry.registerPath({
    method: "post",
    path: "/system-settings/batch",
    tags: ["System Settings"],
    summary: "Cập nhật hàng loạt tham số cài đặt (Chỉ dành cho Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: batchUpdateSystemSettingsSchema,
          },
        },
      },
    },
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
