import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  sendNotificationSchema,
  broadcastNotificationSchema,
  listNotificationsSchema,
  notificationIdParamSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  templateCodeParamSchema,
  templateIdParamSchema,
  previewNotificationTemplateSchema,
  listNotificationTemplatesSchema,
  listEmailsSchema,
  emailIdParamSchema,
  testSendNotificationTemplateSchema,
} from "./notification.validation";
import { z } from "zod";

export function registerNotificationOpenApi(): void {
  openapiRegistry.register("SendNotificationRequest", sendNotificationSchema);
  openapiRegistry.register(
    "BroadcastNotificationRequest",
    broadcastNotificationSchema,
  );
  openapiRegistry.register(
    "CreateTemplateRequest",
    createNotificationTemplateSchema,
  );
  openapiRegistry.register(
    "UpdateTemplateRequest",
    updateNotificationTemplateSchema,
  );
  openapiRegistry.register(
    "PreviewTemplateRequest",
    previewNotificationTemplateSchema,
  );
  openapiRegistry.register(
    "TestSendTemplateRequest",
    testSendNotificationTemplateSchema,
  );

  // ── Web Notifications ────────────────────────────────────────────────────────

  // GET /notifications/stream
  openapiRegistry.registerPath({
    method: "get",
    path: "/notifications/stream",
    tags: ["Notifications"],
    summary:
      "Mở luồng Server-Sent Events (SSE) nhận thông báo & sự kiện thời gian thực",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description:
          "Luồng SSE được thiết lập thành công (Content-Type: text/event-stream)",
        content: {
          "text/event-stream": {
            schema: z.string().openapi({
              example:
                'event: notification:new\ndata: {"title":"New alert"}\n\n',
            }),
          },
        },
      },
      401: {
        description:
          "Chưa xác thực (Yêu cầu JWT qua Cookie, Bearer header hoặc ?token=...)",
      },
    },
  });

  // GET /notifications
  openapiRegistry.registerPath({
    method: "get",
    path: "/notifications",

    tags: ["Notifications"],
    summary: "Danh sách thông báo của người dùng hiện tại",
    security: [{ BearerAuth: [] }],
    request: { query: listNotificationsSchema },
    responses: {
      200: {
        description: "Lấy danh sách thông báo thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  title: z.string(),
                  content: z.string(),
                  type: z.string(),
                  actionUrl: z.string().nullable(),
                  isRead: z.boolean(),
                  readAt: z.string().datetime().nullable(),
                  createdAt: z.string().datetime(),
                }),
              ),
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

  // GET /notifications/unread-count
  openapiRegistry.registerPath({
    method: "get",
    path: "/notifications/unread-count",
    tags: ["Notifications"],
    summary: "Số lượng thông báo chưa đọc",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Lấy số lượng chưa đọc thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ unreadCount: z.number() }),
            }),
          },
        },
      },
    },
  });

  // POST /notifications/send
  openapiRegistry.registerPath({
    method: "post",
    path: "/notifications/send",
    tags: ["Notifications"],
    summary: "Gửi thông báo tới một người dùng cụ thể (Web / Email)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: sendNotificationSchema } },
      },
    },
    responses: {
      201: {
        description: "Gửi thông báo thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                webNotification: z.record(z.unknown()).optional(),
                emailNotification: z.record(z.unknown()).optional(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /notifications/broadcast
  openapiRegistry.registerPath({
    method: "post",
    path: "/notifications/broadcast",
    tags: ["Notifications"],
    summary: "Gửi thông báo quảng bá (Broadcast) tới toàn bộ người dùng",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: broadcastNotificationSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Gửi broadcast thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ count: z.number() }),
            }),
          },
        },
      },
    },
  });

  // PATCH /notifications/:id/read
  openapiRegistry.registerPath({
    method: "patch",
    path: "/notifications/{id}/read",
    tags: ["Notifications"],
    summary: "Đánh dấu thông báo là đã đọc",
    security: [{ BearerAuth: [] }],
    request: { params: notificationIdParamSchema },
    responses: {
      200: {
        description: "Đánh dấu đã đọc thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ id: z.string().uuid(), isRead: z.boolean() }),
            }),
          },
        },
      },
    },
  });

  // PATCH /notifications/read-all
  openapiRegistry.registerPath({
    method: "patch",
    path: "/notifications/read-all",
    tags: ["Notifications"],
    summary: "Đánh dấu toàn bộ thông báo của tôi là đã đọc",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Đánh dấu tất cả đã đọc thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ count: z.number() }),
            }),
          },
        },
      },
    },
  });

  // DELETE /notifications/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/notifications/{id}",
    tags: ["Notifications"],
    summary: "Xóa một thông báo",
    security: [{ BearerAuth: [] }],
    request: { params: notificationIdParamSchema },
    responses: {
      200: {
        description: "Xóa thông báo thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Xóa thông báo thành công" }),
            }),
          },
        },
      },
    },
  });

  // ── Templates ───────────────────────────────────────────────────────────────

  // GET /notifications/templates
  openapiRegistry.registerPath({
    method: "get",
    path: "/notifications/templates",
    tags: ["Notification Templates"],
    summary: "Danh sách mẫu thông báo / email",
    security: [{ BearerAuth: [] }],
    request: { query: listNotificationTemplatesSchema },
    responses: {
      200: {
        description: "Lấy danh sách mẫu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  code: z.string(),
                  name: z.string(),
                  description: z.string().nullable(),
                  channels: z.array(z.string()),
                  subject: z.string().nullable(),
                  title: z.string().nullable(),
                  content: z.string(),
                  variables: z.array(z.string()),
                  isSystem: z.boolean(),
                  isActive: z.boolean(),
                  createdAt: z.string().datetime(),
                }),
              ),
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

  // POST /notifications/templates
  openapiRegistry.registerPath({
    method: "post",
    path: "/notifications/templates",
    tags: ["Notification Templates"],
    summary: "Tạo mẫu thông báo mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createNotificationTemplateSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo mẫu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                code: z.string(),
                name: z.string(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /notifications/templates/:code/preview
  openapiRegistry.registerPath({
    method: "post",
    path: "/notifications/templates/{code}/preview",
    tags: ["Notification Templates"],
    summary: "Xem trước mẫu thông báo khi điền biến dữ liệu",
    security: [{ BearerAuth: [] }],
    request: {
      params: templateCodeParamSchema,
      body: {
        content: {
          "application/json": { schema: previewNotificationTemplateSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Xem trước thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                subject: z.string().nullable(),
                title: z.string().nullable(),
                content: z.string(),
                html: z.string().optional(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /notifications/templates/:code
  openapiRegistry.registerPath({
    method: "get",
    path: "/notifications/templates/{code}",
    tags: ["Notification Templates"],
    summary: "Chi tiết mẫu thông báo theo mã code",
    security: [{ BearerAuth: [] }],
    request: { params: templateCodeParamSchema },
    responses: {
      200: {
        description: "Lấy chi tiết mẫu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                code: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                channels: z.array(z.string()),
                subject: z.string().nullable(),
                title: z.string().nullable(),
                content: z.string(),
                variables: z.array(z.string()),
                isSystem: z.boolean(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
    },
  });

  // PUT /notifications/templates/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/notifications/templates/{id}",
    tags: ["Notification Templates"],
    summary: "Cập nhật mẫu thông báo theo ID",
    security: [{ BearerAuth: [] }],
    request: {
      params: templateIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateNotificationTemplateSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật mẫu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Notification template updated successfully" }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy mẫu thông báo" },
    },
  });

  // DELETE /notifications/templates/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/notifications/templates/{id}",
    tags: ["Notification Templates"],
    summary: "Xóa mẫu thông báo theo ID",
    security: [{ BearerAuth: [] }],
    request: { params: templateIdParamSchema },
    responses: {
      200: {
        description: "Xóa mẫu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Xóa mẫu thông báo thành công" }),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy mẫu thông báo" },
    },
  });

  // POST /notifications/templates/:code/test-send
  openapiRegistry.registerPath({
    method: "post",
    path: "/notifications/templates/{code}/test-send",
    tags: ["Notification Templates"],
    summary: "Gửi thử nghiệm mẫu thông báo tới email hoặc web",
    security: [{ BearerAuth: [] }],
    request: {
      params: templateCodeParamSchema,
      body: {
        content: {
          "application/json": { schema: testSendNotificationTemplateSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Gửi thử nghiệm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Test email sent successfully" }),
            }),
          },
        },
      },
      400: { description: "Mẫu không khả dụng hoặc tham số không đúng" },
    },
  });

  // ── Emails ──────────────────────────────────────────────────────────────────

  // GET /notifications/emails
  openapiRegistry.registerPath({
    method: "get",
    path: "/notifications/emails",
    tags: ["Email Notifications"],
    summary: "Danh sách lịch sử gửi email và trạng thái hàng đợi",
    security: [{ BearerAuth: [] }],
    request: { query: listEmailsSchema },
    responses: {
      200: {
        description: "Lấy lịch sử email thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  toEmail: z.string().email(),
                  subject: z.string(),
                  templateKey: z.string(),
                  status: z.string(),
                  attempts: z.number(),
                  lastError: z.string().nullable(),
                  sentAt: z.string().datetime().nullable(),
                  createdAt: z.string().datetime(),
                }),
              ),
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

  // POST /notifications/emails/:id/retry
  openapiRegistry.registerPath({
    method: "post",
    path: "/notifications/emails/{id}/retry",
    tags: ["Email Notifications"],
    summary: "Gửi lại (Retry) một email thất bại trong hàng đợi",
    security: [{ BearerAuth: [] }],
    request: { params: emailIdParamSchema },
    responses: {
      200: {
        description: "Đã đưa email vào hàng đợi gửi lại",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Email scheduled for retry" }),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy email" },
    },
  });

  // ── Dedicated /notification-templates Routes ───────────────────────────────

  openapiRegistry.registerPath({
    method: "get",
    path: "/notification-templates",
    tags: ["Notification Templates"],
    summary: "Danh sách mẫu thông báo / email (Hub route)",
    security: [{ BearerAuth: [] }],
    request: { query: listNotificationTemplatesSchema },
    responses: {
      200: {
        description: "Lấy danh sách mẫu thành công",
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

  openapiRegistry.registerPath({
    method: "post",
    path: "/notification-templates",
    tags: ["Notification Templates"],
    summary: "Tạo mẫu thông báo mới (Hub route)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createNotificationTemplateSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo mẫu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ id: z.string().uuid(), code: z.string() }),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/notification-templates/{code}",
    tags: ["Notification Templates"],
    summary: "Chi tiết mẫu thông báo theo mã code (Hub route)",
    security: [{ BearerAuth: [] }],
    request: { params: templateCodeParamSchema },
    responses: {
      200: {
        description: "Lấy chi tiết mẫu thành công",
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
}

