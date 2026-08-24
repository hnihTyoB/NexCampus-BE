import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  createApiKeySchema,
  apiKeyIdParamSchema,
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
  deliveryIdParamSchema,
  listDeliveriesQuerySchema,
  triggerJobSchema,
} from './integration.validation';
import { z } from 'zod';

export function registerIntegrationOpenApi(): void {
  openapiRegistry.register('CreateApiKeyRequest', createApiKeySchema);
  openapiRegistry.register('CreateWebhookRequest', createWebhookSchema);
  openapiRegistry.register('UpdateWebhookRequest', updateWebhookSchema);
  openapiRegistry.register('TriggerJobRequest', triggerJobSchema);

  // ── API Keys ────────────────────────────────────────────────────────────────

  // POST /integration/api-keys
  openapiRegistry.registerPath({
    method: 'post',
    path: '/integration/api-keys',
    tags: ['Integrations — API Keys'],
    summary: 'Tạo API Key mới cho hệ thống bên thứ ba (Chỉ hiển thị plaintext 1 lần)',
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: createApiKeySchema } } },
    },
    responses: {
      201: {
        description: 'Tạo API Key thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'API Key được tạo thành công. Hãy lưu key này ngay, nó sẽ không hiển thị lại!' }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                apiKey: z.string().openapi({ example: 'ak_live_a1b2c3d4e5f6...' }),
                prefix: z.string(),
                permissions: z.array(z.string()),
                expiresAt: z.string().datetime().nullable(),
                createdAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /integration/api-keys
  openapiRegistry.registerPath({
    method: 'get',
    path: '/integration/api-keys',
    tags: ['Integrations — API Keys'],
    summary: 'Danh sách API Keys của người dùng hiện tại',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy danh sách API Keys thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  prefix: z.string(),
                  permissions: z.array(z.string()),
                  isActive: z.boolean(),
                  expiresAt: z.string().datetime().nullable(),
                  lastUsedAt: z.string().datetime().nullable(),
                  createdAt: z.string().datetime(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // DELETE /integration/api-keys/:id
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/integration/api-keys/{id}',
    tags: ['Integrations — API Keys'],
    summary: 'Thu hồi / Xóa API Key',
    security: [{ BearerAuth: [] }],
    request: { params: apiKeyIdParamSchema },
    responses: {
      200: {
        description: 'Xóa API Key thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'API Key đã được xóa thành công' }),
            }),
          },
        },
      },
    },
  });

  // PATCH /integration/api-keys/:id/toggle
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/integration/api-keys/{id}/toggle',
    tags: ['Integrations — API Keys'],
    summary: 'Bật / Tắt trạng thái kích hoạt của API Key',
    security: [{ BearerAuth: [] }],
    request: { params: apiKeyIdParamSchema },
    responses: {
      200: {
        description: 'Chuyển đổi trạng thái thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ id: z.string().uuid(), isActive: z.boolean() }),
            }),
          },
        },
      },
    },
  });

  // ── Webhooks ────────────────────────────────────────────────────────────────

  // POST /integration/webhooks
  openapiRegistry.registerPath({
    method: 'post',
    path: '/integration/webhooks',
    tags: ['Integrations — Webhooks'],
    summary: 'Đăng ký Webhook endpoint mới (Kèm bí mật HMAC-SHA256 & bảo vệ SSRF)',
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: createWebhookSchema } } },
    },
    responses: {
      201: {
        description: 'Đăng ký Webhook thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                url: z.string().url(),
                events: z.array(z.string()),
                secret: z.string().openapi({ example: 'whsec_a1b2c3d4...' }),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /integration/webhooks
  openapiRegistry.registerPath({
    method: 'get',
    path: '/integration/webhooks',
    tags: ['Integrations — Webhooks'],
    summary: 'Danh sách các Webhook endpoints đã đăng ký',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy danh sách thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  url: z.string().url(),
                  events: z.array(z.string()),
                  description: z.string().nullable(),
                  isActive: z.boolean(),
                  createdAt: z.string().datetime(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // GET /integration/webhooks/:id
  openapiRegistry.registerPath({
    method: 'get',
    path: '/integration/webhooks/{id}',
    tags: ['Integrations — Webhooks'],
    summary: 'Chi tiết thông tin Webhook endpoint',
    security: [{ BearerAuth: [] }],
    request: { params: webhookIdParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                url: z.string().url(),
                events: z.array(z.string()),
                description: z.string().nullable(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
    },
  });

  // PUT /integration/webhooks/:id
  openapiRegistry.registerPath({
    method: 'put',
    path: '/integration/webhooks/{id}',
    tags: ['Integrations — Webhooks'],
    summary: 'Cập nhật Webhook endpoint (URL, Events, Trạng thái)',
    security: [{ BearerAuth: [] }],
    request: {
      params: webhookIdParamSchema,
      body: { content: { 'application/json': { schema: updateWebhookSchema } } },
    },
    responses: {
      200: {
        description: 'Cập nhật Webhook thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({ id: z.string().uuid() }),
            }),
          },
        },
      },
    },
  });

  // DELETE /integration/webhooks/:id
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/integration/webhooks/{id}',
    tags: ['Integrations — Webhooks'],
    summary: 'Xóa Webhook endpoint',
    security: [{ BearerAuth: [] }],
    request: { params: webhookIdParamSchema },
    responses: {
      200: {
        description: 'Xóa Webhook thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Webhook đã được xóa thành công' }),
            }),
          },
        },
      },
    },
  });

  // POST /integration/webhooks/:id/test
  openapiRegistry.registerPath({
    method: 'post',
    path: '/integration/webhooks/{id}/test',
    tags: ['Integrations — Webhooks'],
    summary: 'Gửi Test Ping sự kiện `test.ping` để kiểm tra endpoint',
    security: [{ BearerAuth: [] }],
    request: { params: webhookIdParamSchema },
    responses: {
      200: {
        description: 'Đã đưa test job vào hàng đợi',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã gửi test ping webhook vào hàng đợi' }),
            }),
          },
        },
      },
    },
  });

  // GET /integration/webhooks/:id/deliveries
  openapiRegistry.registerPath({
    method: 'get',
    path: '/integration/webhooks/{id}/deliveries',
    tags: ['Integrations — Webhooks'],
    summary: 'Lịch sử phân phối (Delivery Logs) của Webhook',
    security: [{ BearerAuth: [] }],
    request: {
      params: webhookIdParamSchema,
      query: listDeliveriesQuerySchema,
    },
    responses: {
      200: {
        description: 'Lấy lịch sử phân phối thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  event: z.string(),
                  status: z.string(),
                  httpStatus: z.number().nullable(),
                  durationMs: z.number().nullable(),
                  attempts: z.number(),
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

  // POST /integration/webhooks/deliveries/:deliveryId/retry
  openapiRegistry.registerPath({
    method: 'post',
    path: '/integration/webhooks/deliveries/{deliveryId}/retry',
    tags: ['Integrations — Webhooks'],
    summary: 'Thử lại (Retry) một lượt gửi Webhook thất bại',
    security: [{ BearerAuth: [] }],
    request: { params: deliveryIdParamSchema },
    responses: {
      200: {
        description: 'Đã đưa retry job vào hàng đợi',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã lập lịch thử lại phân phối Webhook' }),
            }),
          },
        },
      },
    },
  });

  // ── Third-Party Integration Endpoint ─────────────────────────────────────────

  // POST /integration/jobs/trigger
  openapiRegistry.registerPath({
    method: 'post',
    path: '/integration/jobs/trigger',
    tags: ['Integrations — Third-Party API'],
    summary: 'Kích hoạt Background Job từ bên thứ ba (Xác thực bằng X-API-Key)',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: triggerJobSchema } } },
    },
    responses: {
      202: {
        description: 'Job được chấp nhận và đưa vào hàng đợi BullMQ',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Job triggered successfully' }),
              data: z.object({
                jobId: z.string(),
                jobType: z.string(),
                status: z.string().openapi({ example: 'QUEUED' }),
                enqueuedAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
      401: { description: 'API Key không hợp lệ hoặc đã hết hạn' },
    },
  });
}
