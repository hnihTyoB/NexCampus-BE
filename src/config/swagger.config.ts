import { SwaggerUiOptions } from 'swagger-ui-express';

export const swaggerOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper .link img { display: none; }
    .swagger-ui .topbar-wrapper .link::after { content: 'Template API'; color: white; font-size: 1.2rem; font-weight: bold; }
  `,
  customSiteTitle: 'API Documentation',
};

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Backend REST API',
    version: '1.0.0',
    description: 'Backend REST API Template (NodeJS, Express, TypeScript, Prisma, PostgreSQL). Cung cấp hệ thống xác thực, quản lý người dùng và Dynamic RBAC.',
    contact: { name: 'Development Team' },
  },
  servers: [
    { url: '/api/v1', description: 'Development server' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Sử dụng header Authorization: Bearer <accessToken>',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API Key xác thực dành cho hệ thống bên thứ ba (Third-Party Integration)',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 42 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
          code: { type: 'string', example: 'NOT_FOUND' },
        },
      },
      MaintenanceErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.' },
          code: { type: 'string', example: 'SYSTEM_MAINTENANCE' },
          data: {
            type: 'object',
            properties: {
              title: { type: 'string', example: 'Hệ thống đang bảo trì' },
              message: { type: 'string', example: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.' },
              startAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-08-23T00:00:00.000Z' },
              estimatedEndAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-08-23T04:00:00.000Z' },
            },
          },
        },
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          phoneNumber: { type: 'string', nullable: true },
          roleId: { type: 'string', format: 'uuid' },
          role: { $ref: '#/components/schemas/Role' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateUserBody: {
        type: 'object',
        required: ['email', 'password', 'roleId'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@template.local' },
          password: { type: 'string', minLength: 8, example: 'Admin@123456' },
          roleId: { type: 'string', format: 'uuid', example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        },
      },
      UpdateUserBody: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
          roleId: { type: 'string', format: 'uuid' },
        },
      },
      LoginBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@template.local' },
          password: { type: 'string', example: 'Admin@123456' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceName: { type: 'string', example: 'Chrome trên Windows' },
          ipAddress: { type: 'string', example: '127.0.0.1' },
          createdAt: { type: 'string', format: 'date-time' },
          isCurrent: { type: 'boolean', example: false },
        },
      },
      RefreshBody: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      LogoutBody: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      RegisterBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@template.local' },
          password: { type: 'string', minLength: 8, example: 'User@123456' },
          fullName: { type: 'string', example: 'Nguyen Van A' },
        },
      },
      UpdateProfileBody: {
        type: 'object',
        properties: {
          fullName: { type: 'string', example: 'Nguyen Van B' },
          avatarUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/avatar.jpg',
            description: 'Public HTTPS URL. Hệ thống tích hợp cơ chế chống SSRF nâng cao: tự động resolve DNS và kiểm tra chuỗi HTTP redirect, chặn mọi domain/redirect trỏ về private IP (10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1), localhost, hoặc các scheme không an toàn (file:, ftp:, javascript:…).',
          },
          phoneNumber: { type: 'string', example: '0912345678' },
        },
      },
      UpdatePasswordBody: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          oldPassword: { type: 'string', example: 'OldPassword@123' },
          newPassword: { type: 'string', minLength: 8, example: 'NewPassword@123' },
        },
      },
      ForgotPasswordBody: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@template.local' },
        },
      },
      ResetPasswordBody: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', format: 'uuid', example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
          newPassword: { type: 'string', minLength: 8, example: 'NewPassword@123' },
        },
      },
      ResendVerificationBody: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@template.local' },
        },
      },
      Permission: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'USER_READ' },
          description: { type: 'string', example: 'Xem danh sách và chi tiết người dùng' },
          resource: { type: 'string', example: 'USER' },
          action: { type: 'string', example: 'READ' },
          isSystem: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateRoleBody: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'ACCOUNTANT' },
          description: { type: 'string', example: 'Vai trò kế toán theo dõi thu chi' },
          permissionIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      UpdateRoleBody: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'CHIEF_ACCOUNTANT' },
          description: { type: 'string', example: 'Kế toán trưởng' },
        },
      },
      AssignPermissionsBody: {
        type: 'object',
        required: ['permissionIds'],
        properties: {
          permissionIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      AssignUserRoleBody: {
        type: 'object',
        required: ['roleId'],
        properties: {
          roleId: { type: 'string', format: 'uuid' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          actorId: { type: 'string', format: 'uuid', nullable: true },
          action: { type: 'string', example: 'CREATE_ROLE' },
          targetType: { type: 'string', example: 'ROLE' },
          targetId: { type: 'string', example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
          details: { type: 'object' },
          ipAddress: { type: 'string', nullable: true },
          userAgent: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', example: 'SYSTEM' },
          priority: { type: 'string', example: 'NORMAL' },
          title: { type: 'string', example: 'Thông báo hệ thống' },
          content: { type: 'string', example: 'Nội dung chi tiết của thông báo' },
          actionUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'Public HTTPS URL dẫn đến hành động liên quan. Không chấp nhận private IP hay localhost.',
          },
          metadata: { type: 'object', nullable: true },
          isRead: { type: 'boolean', example: false },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      EmailNotification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid', nullable: true },
          toEmail: { type: 'string', format: 'email' },
          subject: { type: 'string' },
          templateKey: { type: 'string', example: 'CUSTOM' },
          status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
          attempts: { type: 'integer' },
          lastError: { type: 'string', nullable: true },
          sentAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SendNotificationBody: {
        type: 'object',
        required: ['userIds', 'channels', 'title', 'content'],
        properties: {
          userIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          channels: { type: 'array', items: { type: 'string', enum: ['WEB', 'EMAIL'] } },
          title: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string', example: 'SYSTEM' },
          priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH'], example: 'NORMAL' },
          actionUrl: {
            type: 'string',
            format: 'uri',
            description: 'Public HTTPS URL dẫn đến hành động liên quan (tuỳ chọn). Tích hợp chống SSRF qua DNS resolution & redirect chaining, chặn private IP và localhost.',
            example: 'https://example.com/action',
          },
          metadata: { type: 'object' },
        },
      },
      BroadcastNotificationBody: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string', example: 'SYSTEM' },
          priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH'], example: 'NORMAL' },
          actionUrl: {
            type: 'string',
            format: 'uri',
            description: 'Public HTTPS URL dẫn đến hành động liên quan (tuỳ chọn). Không chấp nhận private IP hay localhost.',
            example: 'https://example.com/action',
          },
          metadata: { type: 'object' },
        },
      },
      NotificationTemplate: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'WELCOME' },
          name: { type: 'string', example: 'Chào mừng thành viên mới' },
          description: { type: 'string', nullable: true, example: 'Thông báo chào mừng người dùng mới' },
          channels: { type: 'array', items: { type: 'string', enum: ['WEB', 'EMAIL'] }, example: ['WEB'] },
          subject: { type: 'string', nullable: true, example: 'Chào mừng {{fullName}}' },
          title: { type: 'string', nullable: true, example: 'Chào mừng bạn' },
          content: { type: 'string', example: 'Chào mừng {{fullName}} đã gia nhập hệ thống!' },
          variables: { type: 'array', items: { type: 'string' }, example: ['fullName'] },
          isSystem: { type: 'boolean', example: false },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateNotificationTemplateBody: {
        type: 'object',
        required: ['code', 'name', 'channels', 'content'],
        properties: {
          code: { type: 'string', example: 'PROMO_ALERT', description: 'Mã định danh duy nhất (chữ hoa, số, gạch dưới)' },
          name: { type: 'string', example: 'Thông báo khuyến mãi' },
          description: { type: 'string', example: 'Mẫu thông báo ưu đãi đặc biệt' },
          channels: { type: 'array', items: { type: 'string', enum: ['WEB', 'EMAIL'] }, example: ['WEB', 'EMAIL'] },
          subject: { type: 'string', example: 'Ưu đãi dành riêng cho {{fullName}}' },
          title: { type: 'string', example: 'Ưu đãi khủng {{discount}}%' },
          content: { type: 'string', example: 'Xin chào {{fullName}}, nhận ngay mã giảm giá {{discount}}% hôm nay!' },
          variables: { type: 'array', items: { type: 'string' }, example: ['fullName', 'discount'] },
          isActive: { type: 'boolean', default: true },
        },
      },
      UpdateNotificationTemplateBody: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Thông báo khuyến mãi cập nhật' },
          description: { type: 'string' },
          channels: { type: 'array', items: { type: 'string', enum: ['WEB', 'EMAIL'] } },
          subject: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          variables: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
        },
      },
      PreviewNotificationTemplateBody: {
        type: 'object',
        properties: {
          variables: {
            type: 'object',
            example: { fullName: 'Nguyễn Văn A', verificationUrl: 'https://example.com/verify?token=123' },
          },
        },
      },
      TestSendNotificationTemplateBody: {
        type: 'object',
        properties: {
          toEmail: { type: 'string', format: 'email', example: 'test@example.com' },
          channels: { type: 'array', items: { type: 'string', enum: ['WEB', 'EMAIL'] } },
          variables: {
            type: 'object',
            example: { fullName: 'Admin Tester', verifyUrl: 'https://example.com' },
          },
        },
      },
    },
    parameters: {
      PageParam: { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
      LimitParam: { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
      OrderParam: { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
    },
    responses: {
      Unauthorized: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Forbidden: { description: 'Không có quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      NotFound: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Validation: { description: 'Dữ liệu không hợp lệ', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Conflict: { description: 'Xung đột dữ liệu', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      RateLimitExceeded: {
        description: 'Vượt quá giới hạn số lượng request cho phép (Rate Limit Exceeded — 429)',
        headers: {
          'Retry-After': { schema: { type: 'integer' }, description: 'Số giây cần chờ trước khi thử lại' },
          'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Số request tối đa trong cửa sổ thời gian' },
          'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Số request còn lại' },
          'X-RateLimit-Reset': { schema: { type: 'integer' }, description: 'Thời điểm reset (Unix timestamp tính bằng giây)' },
        },
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Health check' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Users', description: 'User account management' },
    { name: 'RBAC', description: 'Dynamic Role-Based Access Control & Permissions' },
    { name: 'Notifications', description: 'Thông báo trong ứng dụng & Quản lý email hệ thống' },
    { name: 'Maintenance', description: 'Quản trị chế độ bảo trì hệ thống' },
    { name: 'Integrations', description: 'Quản lý API Keys, HMAC-signed Webhook Callbacks & Job Dispatcher' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Server đang chạy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng ký tài khoản mới',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterBody' } } } },
        responses: {
          201: {
            description: 'Đăng ký thành công, vui lòng kiểm tra email để kích hoạt tài khoản',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Verification email sent' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Email đã tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          422: { $ref: '#/components/responses/Validation' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
        },
      },
    },
    '/auth/verify-email': {
      get: {
        tags: ['Auth'],
        summary: 'Xác thực kích hoạt email',
        parameters: [{ in: 'query', name: 'token', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Mã xác thực gửi qua email' }],
        responses: {
          200: {
            description: 'Kích hoạt tài khoản thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Email verified successfully' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Token không hợp lệ hoặc đã hết hạn', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập và nhận token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } } },
        responses: {
          200: {
            description: 'Đăng nhập thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/LoginResponse' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/Validation' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
        },
      },
    },
    '/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Gửi lại email xác thực kích hoạt tài khoản',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResendVerificationBody' } } } },
        responses: {
          200: {
            description: 'Gửi lại email xác thực thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Verification email sent successfully' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Tài khoản đã được xác thực trước đó', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Yêu cầu đặt lại mật khẩu (quên mật khẩu)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordBody' } } } },
        responses: {
          200: {
            description: 'Đã gửi link khôi phục mật khẩu qua email',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Password reset link sent to your email' } } },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Đặt lại mật khẩu mới bằng token khôi phục',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordBody' } } } },
        responses: {
          200: {
            description: 'Đặt lại mật khẩu mới thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Password has been reset successfully' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Token không hợp lệ hoặc đã hết hạn', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          422: { $ref: '#/components/responses/Validation' },
          429: { $ref: '#/components/responses/RateLimitExceeded' },
        },
      },
    },
    '/auth/profile': {
      put: {
        tags: ['Auth'],
        summary: 'Cập nhật thông tin cá nhân',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileBody' } } } },
        responses: {
          200: {
            description: 'Cập nhật thông tin thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Profile updated successfully' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/auth/password': {
      put: {
        tags: ['Auth'],
        summary: 'Cập nhật mật khẩu',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePasswordBody' } } } },
        responses: {
          200: {
            description: 'Cập nhật mật khẩu thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Password updated successfully' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy thông tin người dùng hiện tại',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Thông tin tài khoản đang đăng nhập',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Làm mới token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshBody' } } } },
        responses: {
          200: {
            description: 'Cặp token mới',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/TokenPair' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutBody' } } } },
        responses: {
          200: {
            description: 'Đăng xuất thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Logged out successfully' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Token không tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy danh sách các phiên đăng nhập đang hoạt động',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Danh sách các phiên đăng nhập đang hoạt động',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Session' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Đăng xuất khỏi tất cả các thiết bị khác',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Đăng xuất tất cả thiết bị khác thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'All other sessions revoked successfully' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/sessions/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Hủy/Đăng xuất một phiên đăng nhập cụ thể',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'ID của phiên đăng nhập (RefreshToken ID) cần xóa',
          },
        ],
        responses: {
          200: {
            description: 'Đăng xuất thiết bị thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Session revoked successfully' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Danh sách tài khoản',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'email', schema: { type: 'string' }, description: 'Tìm theo email' },
          { in: 'query', name: 'fullName', schema: { type: 'string' }, description: 'Tìm theo tên' },
          { in: 'query', name: 'roleName', schema: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] }, description: 'Lọc theo role' },
          { in: 'query', name: 'isActive', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Lọc theo trạng thái' },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['createdAt', 'email', 'fullName'], default: 'createdAt' } },
          { $ref: '#/components/parameters/OrderParam' },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          200: {
            description: 'Danh sách user có phân trang',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                        meta: { $ref: '#/components/schemas/PaginationMeta' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Tạo tài khoản mới',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserBody' } } } },
        responses: {
          201: {
            description: 'Tài khoản đã tạo',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Chi tiết tài khoản theo ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Thông tin user',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Cập nhật tài khoản',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUserBody' } } } },
        responses: {
          200: {
            description: 'Cập nhật thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Xóa mềm tài khoản',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Xóa mềm tài khoản thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'User soft deleted successfully' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/rbac/roles': {
      get: {
        tags: ['RBAC'],
        summary: 'Danh sách các vai trò (Roles) và quyền tương ứng',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Tìm theo tên hoặc mô tả role' },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          200: {
            description: 'Danh sách roles',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Role' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['RBAC'],
        summary: 'Tạo vai trò mới động',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleBody' } } } },
        responses: {
          201: {
            description: 'Vai trò đã được tạo',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Role' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/rbac/roles/{id}': {
      get: {
        tags: ['RBAC'],
        summary: 'Chi tiết vai trò và danh sách quyền',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Chi tiết vai trò',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Role' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['RBAC'],
        summary: 'Cập nhật thông tin vai trò',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRoleBody' } } } },
        responses: {
          200: {
            description: 'Cập nhật vai trò thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Role' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
      delete: {
        tags: ['RBAC'],
        summary: 'Xóa vai trò tùy chỉnh (chỉ role không phải hệ thống và không có user)',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Xóa vai trò thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { message: { type: 'string', example: 'Role deleted successfully' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/rbac/permissions': {
      get: {
        tags: ['RBAC'],
        summary: 'Danh mục tất cả các permissions trong hệ thống',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Danh mục permissions',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Permission' } } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/rbac/roles/{id}/permissions': {
      get: {
        tags: ['RBAC'],
        summary: 'Xem danh sách quyền được gán cho role',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Danh sách quyền của role',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Permission' } } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['RBAC'],
        summary: 'Đồng bộ/Gán danh sách quyền cho vai trò',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignPermissionsBody' } } } },
        responses: {
          200: {
            description: 'Gán quyền thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Role' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/rbac/roles/{id}/permissions/{permissionId}': {
      delete: {
        tags: ['RBAC'],
        summary: 'Gỡ một quyền cụ thể khỏi vai trò',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'path', name: 'permissionId', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Gỡ quyền thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Role' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/rbac/users/{id}/role': {
      put: {
        tags: ['RBAC'],
        summary: 'Gán vai trò mới cho người dùng',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignUserRoleBody' } } } },
        responses: {
          200: {
            description: 'Gán vai trò cho user thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
    '/rbac/audit-logs': {
      get: {
        tags: ['RBAC'],
        summary: 'Xem danh sách nhật ký kiểm toán (Audit Logs) phân quyền và bảo mật',
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'action', schema: { type: 'string' }, description: 'Lọc theo hành động' },
          { in: 'query', name: 'targetType', schema: { type: 'string' }, description: 'Lọc theo đối tượng (ROLE, USER)' },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          200: {
            description: 'Danh sách nhật ký kiểm toán',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Lấy danh sách thông báo của người dùng',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { in: 'query', name: 'isRead', schema: { type: 'boolean' } },
          { in: 'query', name: 'type', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Danh sách thông báo',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Notification' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'Đếm số thông báo chưa đọc',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Số lượng thông báo chưa đọc',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'object', properties: { unreadCount: { type: 'integer' } } } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Đánh dấu tất cả thông báo là đã đọc',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Đã đánh dấu tất cả là đã đọc',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Đánh dấu 1 thông báo là đã đọc',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Đã đánh dấu là đã đọc',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/notifications/send': {
      post: {
        tags: ['Notifications'],
        summary: 'Gửi thông báo tới danh sách user (Yêu cầu quyền NOTIFICATION_CREATE)',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendNotificationBody' } } } },
        responses: {
          201: {
            description: 'Đã phát thông báo thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/notifications/broadcast': {
      post: {
        tags: ['Notifications'],
        summary: 'Bắn thông báo toàn hệ thống cho tất cả active users (Yêu cầu quyền NOTIFICATION_CREATE)',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BroadcastNotificationBody' } } } },
        responses: {
          201: {
            description: 'Đã phát thông báo toàn hệ thống',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/notifications/emails': {
      get: {
        tags: ['Notifications'],
        summary: 'Xem danh sách nhật ký hàng đợi email (Yêu cầu quyền NOTIFICATION_READ)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] } },
          { in: 'query', name: 'toEmail', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Danh sách email',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/EmailNotification' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/notifications/templates': {
      get: {
        tags: ['Notifications'],
        summary: 'Xem danh sách mẫu thông báo / email (Yêu cầu quyền NOTIFICATION_TEMPLATE_READ)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { in: 'query', name: 'channel', schema: { type: 'string', enum: ['WEB', 'EMAIL'] } },
          { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Danh sách mẫu thông báo',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/NotificationTemplate' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Notifications'],
        summary: 'Tạo mẫu thông báo / email mới (Yêu cầu quyền NOTIFICATION_TEMPLATE_MANAGE)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateNotificationTemplateBody' } } },
        },
        responses: {
          201: {
            description: 'Tạo mẫu thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/NotificationTemplate' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { description: 'Mã code đã tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/notifications/templates/{code}': {
      get: {
        tags: ['Notifications'],
        summary: 'Lấy chi tiết mẫu thông báo theo mã code (Yêu cầu quyền NOTIFICATION_TEMPLATE_READ)',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'code', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Chi tiết mẫu thông báo',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/NotificationTemplate' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/notifications/templates/{id}': {
      put: {
        tags: ['Notifications'],
        summary: 'Cập nhật nội dung mẫu thông báo theo ID (Yêu cầu quyền NOTIFICATION_TEMPLATE_MANAGE)',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateNotificationTemplateBody' } } },
        },
        responses: {
          200: {
            description: 'Cập nhật mẫu thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/NotificationTemplate' } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Notifications'],
        summary: 'Xóa mẫu thông báo tùy biến (Yêu cầu quyền NOTIFICATION_TEMPLATE_MANAGE, không thể xóa mẫu hệ thống)',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Xóa mẫu thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          400: { description: 'Không thể xóa mẫu hệ thống (isSystem=true)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/notifications/templates/{code}/preview': {
      post: {
        tags: ['Notifications'],
        summary: 'Xem trước (preview) nội dung render mẫu thông báo với dữ liệu biến thử nghiệm (Yêu cầu quyền NOTIFICATION_TEMPLATE_READ)',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'code', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PreviewNotificationTemplateBody' } } },
        },
        responses: {
          200: {
            description: 'Nội dung sau khi render biến',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            code: { type: 'string' },
                            subject: { type: 'string', nullable: true },
                            title: { type: 'string', nullable: true },
                            content: { type: 'string' },
                            html: { type: 'string' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/notifications/templates/{code}/test-send': {
      post: {
        tags: ['Notifications'],
        summary: 'Gửi thử nghiệm mẫu thông báo đến người dùng hiện tại hoặc email chỉ định (Yêu cầu quyền NOTIFICATION_TEMPLATE_MANAGE)',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'code', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TestSendNotificationTemplateBody' } } },
        },
        responses: {
          200: {
            description: 'Đã phát gửi thử nghiệm thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/maintenance/public': {
      get: {
        tags: ['Maintenance'],
        summary: 'Kiểm tra trạng thái bảo trì hệ thống (Public - không cần đăng nhập)',
        responses: {
          200: {
            description: 'Thông tin trạng thái bảo trì',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            enabled: { type: 'boolean', example: false },
                            status: { type: 'string', enum: ['ONLINE', 'MAINTENANCE', 'READ_ONLY'], example: 'ONLINE' },
                            title: { type: 'string', example: 'Hệ thống đang bảo trì' },
                            message: { type: 'string', example: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ.' },
                            startAt: { type: 'string', format: 'date-time', nullable: true },
                            estimatedEndAt: { type: 'string', format: 'date-time', nullable: true },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/maintenance/status': {
      get: {
        tags: ['Maintenance'],
        summary: 'Xem chi tiết cấu hình bảo trì hệ thống (Yêu cầu quyền MAINTENANCE_READ hoặc MAINTENANCE_MANAGE)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Chi tiết cấu hình bảo trì',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            key: { type: 'string', example: 'DEFAULT' },
                            enabled: { type: 'boolean', example: false },
                            status: { type: 'string', enum: ['ONLINE', 'MAINTENANCE', 'READ_ONLY'] },
                            title: { type: 'string' },
                            message: { type: 'string' },
                            startAt: { type: 'string', format: 'date-time', nullable: true },
                            estimatedEndAt: { type: 'string', format: 'date-time', nullable: true },
                            bypassPermissions: { type: 'array', items: { type: 'string' } },
                            bypassRoles: { type: 'array', items: { type: 'string' } },
                            bypassIps: { type: 'array', items: { type: 'string' }, example: ['118.69.123.45', '10.0.0.0/24'] },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/maintenance/enable': {
      post: {
        tags: ['Maintenance'],
        summary: 'Bật chế độ bảo trì hệ thống (Yêu cầu quyền MAINTENANCE_MANAGE)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Hệ thống đang bảo trì' },
                  message: { type: 'string', example: 'Bảo trì nâng cấp hạ tầng cơ sở dữ liệu' },
                  startAt: { type: 'string', format: 'date-time' },
                  estimatedEndAt: { type: 'string', format: 'date-time' },
                  status: { type: 'string', enum: ['MAINTENANCE', 'READ_ONLY'], default: 'MAINTENANCE' },
                  bypassPermissions: { type: 'array', items: { type: 'string' }, example: ['MAINTENANCE_MANAGE', 'MAINTENANCE_BYPASS'] },
                  bypassRoles: { type: 'array', items: { type: 'string' }, example: ['ADMIN'] },
                  bypassIps: { type: 'array', items: { type: 'string' }, example: ['118.69.123.45', '10.0.0.0/24'] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Đã bật chế độ bảo trì thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/maintenance/config': {
      put: {
        tags: ['Maintenance'],
        summary: 'Cập nhật cấu hình bảo trì hệ thống (Yêu cầu quyền MAINTENANCE_MANAGE)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  status: { type: 'string', enum: ['ONLINE', 'MAINTENANCE', 'READ_ONLY'] },
                  title: { type: 'string' },
                  message: { type: 'string' },
                  startAt: { type: 'string', format: 'date-time', nullable: true },
                  estimatedEndAt: { type: 'string', format: 'date-time', nullable: true },
                  bypassPermissions: { type: 'array', items: { type: 'string' } },
                  bypassRoles: { type: 'array', items: { type: 'string' } },
                  bypassIps: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Đã cập nhật cấu hình bảo trì thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/maintenance/disable': {
      post: {
        tags: ['Maintenance'],
        summary: 'Tắt chế độ bảo trì hệ thống (Yêu cầu quyền MAINTENANCE_MANAGE)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Đã tắt chế độ bảo trì thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/integrations/api-keys': {
      post: {
        tags: ['Integrations'],
        summary: 'Tạo API Key mới (Yêu cầu quyền API_KEY_MANAGE)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Payment Microservice' },
                  permissions: { type: 'array', items: { type: 'string' }, example: ['USER_READ'] },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'API Key đã được tạo thành công (plaintext key chỉ hiển thị 1 lần duy nhất)',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            name: { type: 'string' },
                            key: { type: 'string', example: 'ak_live_abc123...' },
                            prefix: { type: 'string', example: 'ak_live_abc123...' },
                            permissions: { type: 'array', items: { type: 'string' } },
                            expiresAt: { type: 'string', format: 'date-time', nullable: true },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
      get: {
        tags: ['Integrations'],
        summary: 'Lấy danh sách API Keys của người dùng hiện tại',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Danh sách API Keys',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              name: { type: 'string' },
                              prefix: { type: 'string' },
                              permissions: { type: 'array', items: { type: 'string' } },
                              isActive: { type: 'boolean' },
                              lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
                              expiresAt: { type: 'string', format: 'date-time', nullable: true },
                              createdAt: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/integrations/webhooks': {
      post: {
        tags: ['Integrations'],
        summary: 'Đăng ký Webhook Endpoint mới (Tự động mã hóa secret AES-256-GCM)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: { type: 'string', format: 'uri', example: 'https://example.com/webhook-receiver' },
                  events: { type: 'array', items: { type: 'string' }, example: ['job.completed', 'job.failed'] },
                  secret: { type: 'string', minLength: 16, description: 'Secret tùy chọn để ký HMAC (tự sinh ngẫu nhiên nếu để trống)' },
                  description: { type: 'string', example: 'Core ERP Integration' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Đăng ký Webhook thành công',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
      get: {
        tags: ['Integrations'],
        summary: 'Lấy danh sách Webhook Endpoints đã đăng ký của người dùng',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Danh sách Webhooks',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/integrations/jobs/trigger': {
      post: {
        tags: ['Integrations'],
        summary: 'Khởi tạo Job bất đồng bộ từ bên thứ ba (Xác thực qua header X-API-Key)',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['taskName'],
                properties: {
                  taskName: { type: 'string', example: 'export_daily_ledger' },
                  data: { type: 'object', example: { date: '2026-08-23' } },
                  simulateError: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Job được chấp nhận xử lý. Webhook callback có chữ ký HMAC sẽ tự động gửi tới endpoint của chủ sở hữu.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            jobId: { type: 'string', example: 'job_123e4567...' },
                            taskName: { type: 'string', example: 'export_daily_ledger' },
                            status: { type: 'string', example: 'COMPLETED' },
                            webhooksNotified: { type: 'integer', example: 1 },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/Validation' },
        },
      },
    },
  },
};