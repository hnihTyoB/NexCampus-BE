import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  findAllUserSchema,
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from './user.validation';
import { z } from 'zod';

export function registerUserOpenApi(): void {
  openapiRegistry.register('CreateUserRequest', createUserSchema);
  openapiRegistry.register('UpdateUserRequest', updateUserSchema);

  // GET /users
  openapiRegistry.registerPath({
    method: 'get',
    path: '/users',
    tags: ['Users'],
    summary: 'Danh sách người dùng (Phân trang, tìm kiếm & lọc)',
    security: [{ BearerAuth: [] }],
    request: {
      query: findAllUserSchema,
    },
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
                  email: z.string().email(),
                  fullName: z.string().nullable(),
                  phoneNumber: z.string().nullable(),
                  avatarUrl: z.string().nullable(),
                  isActive: z.boolean(),
                  isEmailVerified: z.boolean(),
                  role: z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    description: z.string().nullable(),
                  }),
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
      403: { description: 'Không có quyền USER_READ' },
    },
  });

  // GET /users/:id
  openapiRegistry.registerPath({
    method: 'get',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Chi tiết thông tin người dùng theo ID',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
    },
    responses: {
      200: {
        description: 'Lấy chi tiết thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                isActive: z.boolean(),
                isEmailVerified: z.boolean(),
                role: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  description: z.string().nullable(),
                }),
                createdAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });

  // POST /users
  openapiRegistry.registerPath({
    method: 'post',
    path: '/users',
    tags: ['Users'],
    summary: 'Tạo tài khoản người dùng mới (Dành cho Quản trị viên)',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: createUserSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Tạo người dùng thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                roleId: z.string().uuid(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
      400: { description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại' },
    },
  });

  // PUT /users/:id
  openapiRegistry.registerPath({
    method: 'put',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Cập nhật thông tin người dùng theo ID',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
      body: {
        content: {
          'application/json': { schema: updateUserSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });

  // DELETE /users/:id
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Xóa mềm người dùng (Soft delete & vô hiệu hóa phiên đăng nhập)',
    security: [{ BearerAuth: [] }],
    request: {
      params: userIdParamSchema,
    },
    responses: {
      200: {
        description: 'Xóa người dùng thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Xóa người dùng thành công' }),
            }),
          },
        },
      },
      404: { description: 'Không tìm thấy người dùng' },
    },
  });
}
