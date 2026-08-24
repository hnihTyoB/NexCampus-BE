import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  enableMaintenanceSchema,
  updateMaintenanceSchema,
} from './maintenance.validation';
import { z } from 'zod';

export function registerMaintenanceOpenApi(): void {
  openapiRegistry.register('EnableMaintenanceRequest', enableMaintenanceSchema);
  openapiRegistry.register('UpdateMaintenanceRequest', updateMaintenanceSchema);

  // GET /maintenance/public
  openapiRegistry.registerPath({
    method: 'get',
    path: '/maintenance/public',
    tags: ['Maintenance'],
    summary: 'Lấy trạng thái bảo trì hệ thống công khai (Client / Frontend bootstrap)',
    responses: {
      200: {
        description: 'Lấy trạng thái bảo trì thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                enabled: z.boolean(),
                status: z.string().openapi({ example: 'ONLINE' }),
                title: z.string(),
                message: z.string(),
                startAt: z.string().datetime().nullable(),
                estimatedEndAt: z.string().datetime().nullable(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /maintenance/config
  openapiRegistry.registerPath({
    method: 'get',
    path: '/maintenance/config',
    tags: ['Maintenance'],
    summary: 'Chi tiết cấu hình bảo trì hệ thống đầy đủ (Dành cho Quản trị viên)',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                key: z.string(),
                enabled: z.boolean(),
                status: z.string(),
                title: z.string(),
                message: z.string(),
                startAt: z.string().datetime().nullable(),
                estimatedEndAt: z.string().datetime().nullable(),
                bypassPermissions: z.array(z.string()),
                bypassRoles: z.array(z.string()),
                bypassIps: z.array(z.string()),
              }),
            }),
          },
        },
      },
      403: { description: 'Không có quyền MAINTENANCE_MANAGE' },
    },
  });

  // POST /maintenance/enable
  openapiRegistry.registerPath({
    method: 'post',
    path: '/maintenance/enable',
    tags: ['Maintenance'],
    summary: 'Bật chế độ bảo trì hệ thống',
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: enableMaintenanceSchema } } },
    },
    responses: {
      200: {
        description: 'Bật bảo trì thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã kích hoạt chế độ bảo trì hệ thống' }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // POST /maintenance/disable
  openapiRegistry.registerPath({
    method: 'post',
    path: '/maintenance/disable',
    tags: ['Maintenance'],
    summary: 'Tắt chế độ bảo trì hệ thống (Đưa hệ thống về ONLINE)',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Tắt bảo trì thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã tắt chế độ bảo trì hệ thống' }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // PUT /maintenance/config
  openapiRegistry.registerPath({
    method: 'put',
    path: '/maintenance/config',
    tags: ['Maintenance'],
    summary: 'Cập nhật cấu hình bảo trì, danh sách whitelist IP, vai trò bypass',
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: updateMaintenanceSchema } } },
    },
    responses: {
      200: {
        description: 'Cập nhật cấu hình thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Cập nhật cấu hình bảo trì thành công' }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });
}
