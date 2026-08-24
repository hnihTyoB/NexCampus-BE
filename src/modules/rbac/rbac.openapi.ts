import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
  assignUserRoleSchema,
  roleIdParamSchema,
  rolePermissionParamsSchema,
  roleQuerySchema,
  auditLogQuerySchema,
} from './rbac.validation';
import { userIdParamSchema } from '../users/user.validation';
import { z } from 'zod';

export function registerRbacOpenApi(): void {
  openapiRegistry.register('CreateRoleRequest', createRoleSchema);
  openapiRegistry.register('UpdateRoleRequest', updateRoleSchema);
  openapiRegistry.register('AssignPermissionsRequest', assignPermissionsSchema);
  openapiRegistry.register('AssignUserRoleRequest', assignUserRoleSchema);

  // ── Roles ───────────────────────────────────────────────────────────────────

  // GET /rbac/roles
  openapiRegistry.registerPath({
    method: 'get',
    path: '/rbac/roles',
    tags: ['RBAC'],
    summary: 'Danh sách các vai trò (Roles) trong hệ thống',
    security: [{ BearerAuth: [] }],
    request: { query: roleQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách vai trò thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  description: z.string().nullable(),
                  isSystem: z.boolean(),
                  userCount: z.number(),
                  permissions: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      description: z.string().nullable(),
                      action: z.string(),
                      resource: z.string(),
                    }),
                  ),
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

  // GET /rbac/roles/:id
  openapiRegistry.registerPath({
    method: 'get',
    path: '/rbac/roles/{id}',
    tags: ['RBAC'],
    summary: 'Chi tiết thông tin vai trò theo ID kèm danh sách quyền',
    security: [{ BearerAuth: [] }],
    request: { params: roleIdParamSchema },
    responses: {
      200: {
        description: 'Lấy chi tiết vai trò thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().nullable(),
                isSystem: z.boolean(),
                permissions: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    description: z.string().nullable(),
                  }),
                ),
              }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy vai trò' },
    },
  });

  // POST /rbac/roles
  openapiRegistry.registerPath({
    method: 'post',
    path: '/rbac/roles',
    tags: ['RBAC'],
    summary: 'Tạo vai trò mới',
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: createRoleSchema } } },
    },
    responses: {
      201: {
        description: 'Tạo vai trò thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().nullable(),
                isSystem: z.boolean(),
              }),
            }),
          },
        },
      },
    },
  });

  // PUT /rbac/roles/:id
  openapiRegistry.registerPath({
    method: 'put',
    path: '/rbac/roles/{id}',
    tags: ['RBAC'],
    summary: 'Cập nhật vai trò (Tên & mô tả)',
    security: [{ BearerAuth: [] }],
    request: {
      params: roleIdParamSchema,
      body: { content: { 'application/json': { schema: updateRoleSchema } } },
    },
    responses: {
      200: {
        description: 'Cập nhật vai trò thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().nullable(),
              }),
            }),
          },
        },
      },
      403: { description: 'Không thể chỉnh sửa System Role' },
    },
  });

  // DELETE /rbac/roles/:id
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/rbac/roles/{id}',
    tags: ['RBAC'],
    summary: 'Xóa vai trò tùy biến',
    security: [{ BearerAuth: [] }],
    request: { params: roleIdParamSchema },
    responses: {
      200: {
        description: 'Xóa vai trò thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Xóa vai trò thành công' }),
            }),
          },
        },
      },
      403: { description: 'Không thể xóa System Role hoặc vai trò đang có người dùng' },
    },
  });

  // ── Permissions ─────────────────────────────────────────────────────────────

  // GET /rbac/permissions
  openapiRegistry.registerPath({
    method: 'get',
    path: '/rbac/permissions',
    tags: ['RBAC'],
    summary: 'Danh sách toàn bộ các quyền (Permissions) trong hệ thống',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy danh sách quyền thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  description: z.string().nullable(),
                  action: z.string(),
                  resource: z.string(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // GET /rbac/roles/:id/permissions
  openapiRegistry.registerPath({
    method: 'get',
    path: '/rbac/roles/{id}/permissions',
    tags: ['RBAC'],
    summary: 'Lấy danh sách quyền thuộc về một vai trò cụ thể',
    security: [{ BearerAuth: [] }],
    request: { params: roleIdParamSchema },
    responses: {
      200: {
        description: 'Lấy quyền của vai trò thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  action: z.string(),
                  resource: z.string(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // POST /rbac/roles/:id/permissions
  openapiRegistry.registerPath({
    method: 'post',
    path: '/rbac/roles/{id}/permissions',
    tags: ['RBAC'],
    summary: 'Đồng bộ toàn bộ danh sách quyền cho vai trò (Gán / Hủy quyền)',
    security: [{ BearerAuth: [] }],
    request: {
      params: roleIdParamSchema,
      body: { content: { 'application/json': { schema: assignPermissionsSchema } } },
    },
    responses: {
      200: {
        description: 'Đồng bộ quyền thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đồng bộ quyền cho vai trò thành công' }),
            }),
          },
        },
      },
      403: { description: 'Không thể tước quyền quản trị tối cao khỏi ADMIN' },
    },
  });

  // DELETE /rbac/roles/:id/permissions/:permissionId
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/rbac/roles/{id}/permissions/{permissionId}',
    tags: ['RBAC'],
    summary: 'Gỡ bỏ một quyền cụ thể khỏi vai trò',
    security: [{ BearerAuth: [] }],
    request: { params: rolePermissionParamsSchema },
    responses: {
      200: {
        description: 'Gỡ quyền thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Xóa quyền khỏi vai trò thành công' }),
            }),
          },
        },
      },
    },
  });

  // PUT /rbac/users/:id/role
  openapiRegistry.registerPath({
    method: 'put',
    path: '/rbac/users/{id}/role',
    tags: ['RBAC'],
    summary: 'Gán vai trò mới cho người dùng (Chuyển đổi Role)',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
      body: { content: { 'application/json': { schema: assignUserRoleSchema } } },
    },
    responses: {
      200: {
        description: 'Đổi vai trò người dùng thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Gán vai trò cho người dùng thành công' }),
            }),
          },
        },
      },
    },
  });

  // GET /rbac/audit-logs
  openapiRegistry.registerPath({
    method: 'get',
    path: '/rbac/audit-logs',
    tags: ['RBAC'],
    summary: 'Nhật ký kiểm toán hệ thống (Audit Logs)',
    security: [{ BearerAuth: [] }],
    request: { query: auditLogQuerySchema },
    responses: {
      200: {
        description: 'Lấy nhật ký kiểm toán thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  action: z.string(),
                  targetType: z.string(),
                  targetId: z.string(),
                  details: z.record(z.unknown()).nullable(),
                  ipAddress: z.string().nullable(),
                  userAgent: z.string().nullable(),
                  createdAt: z.string().datetime(),
                  actor: z
                    .object({
                      id: z.string().uuid(),
                      email: z.string().email(),
                      fullName: z.string().nullable(),
                    })
                    .nullable(),
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
}
