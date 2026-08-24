import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  createSystemConfigSchema,
  updateSystemConfigSchema,
  toggleFeatureFlagSchema,
  configKeyParamSchema,
  querySystemConfigsSchema,
} from './system-config.validation';
import { z } from 'zod';

export function registerSystemConfigOpenApi(): void {
  openapiRegistry.register('CreateSystemConfigRequest', createSystemConfigSchema);
  openapiRegistry.register('UpdateSystemConfigRequest', updateSystemConfigSchema);
  openapiRegistry.register('ToggleFeatureFlagRequest', toggleFeatureFlagSchema);

  // GET /system/public
  openapiRegistry.registerPath({
    method: 'get',
    path: '/system/public',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Lấy các cấu hình công khai & cờ tính năng (Dành cho Frontend / Web / App Bootstrap)',
    responses: {
      200: {
        description: 'Lấy cấu hình công khai thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  key: z.string(),
                  value: z.unknown(),
                  category: z.string(),
                  description: z.string().nullable(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // GET /system/configs
  openapiRegistry.registerPath({
    method: 'get',
    path: '/system/configs',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Danh sách toàn bộ cấu hình hệ thống & cờ tính năng (Dành cho Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: { query: querySystemConfigsSchema },
    responses: {
      200: {
        description: 'Lấy danh sách cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  key: z.string(),
                  value: z.unknown(),
                  category: z.string(),
                  description: z.string().nullable(),
                  isPublic: z.boolean(),
                  createdAt: z.string().datetime(),
                  updatedAt: z.string().datetime(),
                }),
              ),
            }),
          },
        },
      },
      403: { description: 'Không có quyền SYSTEM_CONFIG_READ' },
    },
  });

  // GET /system/configs/:key
  openapiRegistry.registerPath({
    method: 'get',
    path: '/system/configs/{key}',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Chi tiết cấu hình hệ thống theo Key',
    security: [{ BearerAuth: [] }],
    request: { params: configKeyParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                key: z.string(),
                value: z.unknown(),
                category: z.string(),
                description: z.string().nullable(),
                isPublic: z.boolean(),
              }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy cấu hình' },
    },
  });

  // POST /system/configs
  openapiRegistry.registerPath({
    method: 'post',
    path: '/system/configs',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Tạo mới hoặc cập nhật cấu hình hệ thống',
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: createSystemConfigSchema } } },
    },
    responses: {
      201: {
        description: 'Tạo cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // PUT /system/configs/:key
  openapiRegistry.registerPath({
    method: 'put',
    path: '/system/configs/{key}',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Cập nhật giá trị cấu hình hệ thống',
    security: [{ BearerAuth: [] }],
    request: {
      params: configKeyParamSchema,
      body: { content: { 'application/json': { schema: updateSystemConfigSchema } } },
    },
    responses: {
      200: {
        description: 'Cập nhật cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // PATCH /system/features/:key/toggle
  openapiRegistry.registerPath({
    method: 'patch',
    path: '/system/features/{key}/toggle',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Bật / Tắt nhanh một Feature Flag cụ thể',
    security: [{ BearerAuth: [] }],
    request: {
      params: configKeyParamSchema,
      body: { content: { 'application/json': { schema: toggleFeatureFlagSchema } } },
    },
    responses: {
      200: {
        description: 'Chuyển đổi cờ tính năng thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Cập nhật Feature Flag thành công' }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // DELETE /system/configs/:key
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/system/configs/{key}',
    tags: ['System Configuration & Feature Flags'],
    summary: 'Xóa một cấu hình hệ thống',
    security: [{ BearerAuth: [] }],
    request: { params: configKeyParamSchema },
    responses: {
      200: {
        description: 'Xóa cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Xóa cấu hình thành công' }),
            }),
          },
        },
      },
    },
  });
}
