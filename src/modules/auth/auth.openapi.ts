import { openapiRegistry } from '../../config/openapi/openapi.registry';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  refreshSchema,
  logoutSchema,
  updateProfileSchema,
  updatePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  sessionIdParamSchema,
  getAvatarUploadUrlSchema,
  confirmAvatarUploadSchema,
  revokeOtherSessionsSchema,
} from './auth.validation';
import { z } from 'zod';

export function registerAuthOpenApi(): void {
  // ── Schemas ──────────────────────────────────────────────────────────────────
  openapiRegistry.register('LoginRequest', loginSchema);
  openapiRegistry.register('RegisterRequest', registerSchema);
  openapiRegistry.register('UpdateProfileRequest', updateProfileSchema);
  openapiRegistry.register('UpdatePasswordRequest', updatePasswordSchema);
  openapiRegistry.register('ForgotPasswordRequest', forgotPasswordSchema);
  openapiRegistry.register('ResetPasswordRequest', resetPasswordSchema);
  openapiRegistry.register('ResendVerificationRequest', resendVerificationSchema);
  openapiRegistry.register('GetAvatarUploadUrlRequest', getAvatarUploadUrlSchema);
  openapiRegistry.register('ConfirmAvatarUploadRequest', confirmAvatarUploadSchema);

  // ── Routes ───────────────────────────────────────────────────────────────────

  // POST /auth/register
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['Auth'],
    summary: 'Đăng ký tài khoản người dùng mới',
    request: {
      body: {
        content: {
          'application/json': { schema: registerSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Đăng ký thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực.' }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                isEmailVerified: z.boolean(),
              }),
            }),
          },
        },
      },
      400: { description: 'Dữ liệu không hợp lệ / Email đã tồn tại' },
    },
  });

  // GET /auth/verify-email
  openapiRegistry.registerPath({
    method: 'get',
    path: '/auth/verify-email',
    tags: ['Auth'],
    summary: 'Xác thực email qua token',
    request: {
      query: verifyEmailSchema,
    },
    responses: {
      200: {
        description: 'Xác thực email thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Email đã được xác thực thành công.' }),
            }),
          },
        },
      },
      400: { description: 'Token không hợp lệ hoặc đã hết hạn' },
    },
  });

  // POST /auth/login
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    summary: 'Đăng nhập người dùng',
    request: {
      body: {
        content: {
          'application/json': { schema: loginSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Đăng nhập thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                accessToken: z.string(),
                refreshToken: z.string(),
                user: z.object({
                  id: z.string().uuid(),
                  email: z.string().email(),
                  fullName: z.string().nullable(),
                  role: z.string(),
                  permissions: z.array(z.string()),
                }),
              }),
            }),
          },
        },
      },
      401: { description: 'Email hoặc mật khẩu không chính xác' },
    },
  });

  // GET /auth/me
  openapiRegistry.registerPath({
    method: 'get',
    path: '/auth/me',
    tags: ['Auth'],
    summary: 'Lấy thông tin tài khoản hiện tại',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy thông tin thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                role: z.string(),
                permissions: z.array(z.string()),
              }),
            }),
          },
        },
      },
      401: { description: 'Chưa xác thực' },
    },
  });

  // POST /auth/refresh
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Auth'],
    summary: 'Làm mới Access Token bằng Refresh Token',
    request: {
      body: {
        content: {
          'application/json': { schema: refreshSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Làm mới token thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                accessToken: z.string(),
                refreshToken: z.string(),
                permissions: z.array(z.string()),
              }),
            }),
          },
        },
      },
      401: { description: 'Refresh token không hợp lệ hoặc đã hết hạn' },
    },
  });

  // POST /auth/logout
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Auth'],
    summary: 'Đăng xuất tài khoản',
    request: {
      body: {
        content: {
          'application/json': { schema: logoutSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Đăng xuất thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đăng xuất thành công' }),
            }),
          },
        },
      },
    },
  });

  // PUT /auth/profile
  openapiRegistry.registerPath({
    method: 'put',
    path: '/auth/profile',
    tags: ['Auth'],
    summary: 'Cập nhật thông tin cá nhân',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: updateProfileSchema },
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
                avatarUrl: z.string().nullable(),
                phoneNumber: z.string().nullable(),
              }),
            }),
          },
        },
      },
      401: { description: 'Chưa xác thực' },
    },
  });

  // PUT /auth/password
  openapiRegistry.registerPath({
    method: 'put',
    path: '/auth/password',
    tags: ['Auth'],
    summary: 'Đổi mật khẩu tài khoản',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: updatePasswordSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Đổi mật khẩu thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đổi mật khẩu thành công' }),
            }),
          },
        },
      },
      400: { description: 'Mật khẩu cũ không chính xác' },
      401: { description: 'Chưa xác thực' },
    },
  });

  // POST /auth/forgot-password
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/forgot-password',
    tags: ['Auth'],
    summary: 'Yêu cầu gửi email khôi phục mật khẩu',
    request: {
      body: {
        content: {
          'application/json': { schema: forgotPasswordSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Gửi yêu cầu thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/reset-password
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/reset-password',
    tags: ['Auth'],
    summary: 'Đặt lại mật khẩu qua reset token',
    request: {
      body: {
        content: {
          'application/json': { schema: resetPasswordSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Đặt lại mật khẩu thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Mật khẩu đã được đặt lại thành công.' }),
            }),
          },
        },
      },
      400: { description: 'Token không hợp lệ hoặc đã hết hạn' },
    },
  });

  // POST /auth/resend-verification
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/resend-verification',
    tags: ['Auth'],
    summary: 'Gửi lại email xác thực tài khoản',
    request: {
      body: {
        content: {
          'application/json': { schema: resendVerificationSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Gửi lại email thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Nếu email tồn tại và chưa xác thực, email kích hoạt đã được gửi lại.' }),
            }),
          },
        },
      },
    },
  });

  // GET /auth/sessions
  openapiRegistry.registerPath({
    method: 'get',
    path: '/auth/sessions',
    tags: ['Auth'],
    summary: 'Danh sách các phiên đăng nhập hoạt động',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Lấy danh sách phiên thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  userAgent: z.string().nullable(),
                  ipAddress: z.string().nullable(),
                  createdAt: z.string().datetime(),
                  expiresAt: z.string().datetime(),
                  isCurrent: z.boolean(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // DELETE /auth/sessions/:id
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/auth/sessions/{id}',
    tags: ['Auth'],
    summary: 'Thu hồi một phiên đăng nhập cụ thể',
    security: [{ BearerAuth: [] }],
    request: {
      params: sessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Thu hồi phiên thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Thu hồi phiên đăng nhập thành công' }),
            }),
          },
        },
      },
    },
  });

  // DELETE /auth/sessions
  openapiRegistry.registerPath({
    method: 'delete',
    path: '/auth/sessions',
    tags: ['Auth'],
    summary: 'Thu hồi toàn bộ các phiên đăng nhập khác',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: revokeOtherSessionsSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Thu hồi các phiên khác thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: 'Đã thu hồi tất cả các phiên đăng nhập khác' }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/avatar/upload-url
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/avatar/upload-url',
    tags: ['Auth'],
    summary: 'Lấy Presigned URL tải lên Avatar lên Cloudflare R2 / S3',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: getAvatarUploadUrlSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Tạo upload URL thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                uploadUrl: z.string().url(),
                key: z.string(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/avatar/confirm
  openapiRegistry.registerPath({
    method: 'post',
    path: '/auth/avatar/confirm',
    tags: ['Auth'],
    summary: 'Xác nhận hoàn tất tải lên Avatar',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: confirmAvatarUploadSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Cập nhật avatar thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                avatarUrl: z.string().url(),
              }),
            }),
          },
        },
      },
    },
  });
}
