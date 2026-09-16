import { z } from "zod";
import { openapiRegistry } from "../../config/openapi/openapi.registry";
import { updateNotificationSettingSchema } from "./notification-setting.validation";

export function registerNotificationSettingOpenApi(): void {
  openapiRegistry.register(
    "UpdateNotificationSettingRequest",
    updateNotificationSettingSchema,
  );

  const notificationSettingResponseSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    emailEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    webEnabled: z.boolean(),
    taskAssignedEmail: z.boolean(),
    taskAssignedInApp: z.boolean(),
    submissionReviewedEmail: z.boolean(),
    submissionReviewedInApp: z.boolean(),
    dailyReportReminderEmail: z.boolean(),
    dailyReportReminderInApp: z.boolean(),
    meetingScheduleEmail: z.boolean(),
    meetingScheduleInApp: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  });

  openapiRegistry.register(
    "NotificationSettingResponse",
    notificationSettingResponseSchema,
  );

  openapiRegistry.registerPath({
    method: "get",
    path: "/notification-settings",
    tags: ["Notification Settings"],
    summary: "Lấy cấu hình nhận thông báo của người dùng",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Lấy cấu hình thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: notificationSettingResponseSchema,
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/notification-settings",
    tags: ["Notification Settings"],
    summary: "Cập nhật cấu hình nhận thông báo của người dùng",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: updateNotificationSettingSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật cấu hình thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: notificationSettingResponseSchema,
            }),
          },
        },
      },
    },
  });
}
